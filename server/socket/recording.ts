import { Server as SocketIOServer, Socket } from "socket.io";
import {
  createSession,
  updateSessionStatus,
  updateSessionDuration,
  logError,
} from "../services/sessionService";
import { processAudioChunk } from "../services/audioProcessor";
import { generateSummary } from "../services/audioProcessor";
import { PrismaClient } from "@prisma/client";

interface StartRecordingData {
  source: "MIC" | "TAB_SHARE";
  title?: string;
}

interface AudioChunkData {
  sessionId: string;
  chunk: Buffer;
  chunkIndex: number;
  timestamp: number;
}

interface SessionControlData {
  sessionId: string;
}

const prisma = new PrismaClient();

export function registerRecordingHandlers(io: SocketIOServer, socket: Socket) {
  // Start recording
  socket.on("start-recording", async (data: StartRecordingData, callback) => {
    try {
      const userId = socket.data.userId;
      const { source, title } = data;

      // Create session in database
      const session = await createSession(userId, source, title);

      // Join room for this session
      socket.join(`session-${session.id}`);
      socket.data.currentSessionId = session.id;

      console.log(`Recording started: Session ${session.id} by user ${userId}`);

      // Send success response
      callback({
        success: true,
        sessionId: session.id,
        session,
      });

      // Broadcast status to room
      io.to(`session-${session.id}`).emit("recording-status", {
        status: "RECORDING",
        sessionId: session.id,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      callback({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to start recording",
      });
    }
  });

  // Receive audio chunk
  socket.on("audio-chunk", async (data: AudioChunkData, callback) => {
    try {
      const { sessionId, chunk, chunkIndex, timestamp } = data;

      // Verify session belongs to user
      if (socket.data.currentSessionId !== sessionId) {
        throw new Error("Session ID mismatch");
      }

      // Process audio chunk (will integrate Gemini tomorrow)
      const transcription = await processAudioChunk(
        sessionId,
        chunk,
        chunkIndex,
        timestamp
      );

      // Send transcription update to client
      io.to(`session-${sessionId}`).emit("transcription-update", {
        sessionId,
        chunkIndex,
        text: transcription.text,
        timestamp,
        confidence: transcription.confidence,
      });

      callback({ success: true });
    } catch (error) {
      console.error("Error processing audio chunk:", error);

      // Log error to database
      if (data.sessionId) {
        await logError(data.sessionId, "AUDIO_PROCESSING_ERROR", error);
      }

      callback({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to process audio chunk",
      });
    }
  });

  // Pause recording
  socket.on("pause-recording", async (data: SessionControlData, callback) => {
    try {
      const { sessionId } = data;

      await updateSessionStatus(sessionId, "PAUSED");

      console.log(`Recording paused: Session ${sessionId}`);

      io.to(`session-${sessionId}`).emit("recording-status", {
        status: "PAUSED",
        sessionId,
        timestamp: new Date(),
      });

      callback({ success: true });
    } catch (error) {
      console.error("Error pausing recording:", error);
      callback({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to pause recording",
      });
    }
  });

  // Resume recording
  socket.on("resume-recording", async (data: SessionControlData, callback) => {
    try {
      const { sessionId } = data;

      await updateSessionStatus(sessionId, "RECORDING");

      console.log(`Recording resumed: Session ${sessionId}`);

      io.to(`session-${sessionId}`).emit("recording-status", {
        status: "RECORDING",
        sessionId,
        timestamp: new Date(),
      });

      callback({ success: true });
    } catch (error) {
      console.error("Error resuming recording:", error);
      callback({
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to resume recording",
      });
    }
  });

  // Stop recording
  socket.on(
    "stop-recording",
    async (data: SessionControlData & { duration: number }, callback) => {
      try {
        const { sessionId, duration } = data;

        console.log(
          `Recording stopped: Session ${sessionId}, Duration: ${duration}s`
        );

        // Update session status and duration
        await updateSessionStatus(sessionId, "PROCESSING");
        await updateSessionDuration(sessionId, duration);

        // Notify client processing started
        io.to(`session-${sessionId}`).emit("recording-status", {
          status: "PROCESSING",
          sessionId,
          timestamp: new Date(),
        });

        // Generate summary in background (don't block response)
        (async () => {
          try {
            console.log(
              `🤖 Starting summary generation for session ${sessionId}...`
            );

            // Get all transcripts for this session
            const transcripts = await prisma.transcript.findMany({
              where: { sessionId },
              orderBy: { chunkIndex: "asc" },
            });

            // Combine transcripts
            const fullTranscript = transcripts.map((t) => t.text).join(" ");

            console.log(
              `📝 Full transcript length: ${fullTranscript.length} characters`
            );

            // Generate summary using Gemini
            const summaryData = await generateSummary(
              sessionId,
              fullTranscript
            );

            // Save summary to database
            await prisma.summary.create({
              data: {
                sessionId,
                fullSummary: summaryData.fullSummary,
                keyPoints: summaryData.keyPoints,
                actionItems: summaryData.actionItems,
                decisions: summaryData.decisions,
              },
            });

            // Update session with full transcript and mark completed
            await prisma.recordingSession.update({
              where: { id: sessionId },
              data: {
                fullTranscript,
                status: "COMPLETED",
              },
            });

            console.log(
              `✅ Summary generated and saved for session ${sessionId}`
            );

            // Notify client that processing is complete
            io.to(`session-${sessionId}`).emit("recording-status", {
              status: "COMPLETED",
              sessionId,
              timestamp: new Date(),
            });

            // Send summary to client
            io.to(`session-${sessionId}`).emit("summary-generated", {
              sessionId,
              summary: summaryData,
            });
          } catch (summaryError) {
            console.error(
              `❌ Error generating summary for session ${sessionId}:`,
              summaryError
            );

            // Mark as completed even if summary fails
            await updateSessionStatus(sessionId, "COMPLETED");
            await logError(sessionId, "SUMMARY_GENERATION_ERROR", summaryError);

            io.to(`session-${sessionId}`).emit("recording-status", {
              status: "COMPLETED",
              sessionId,
              timestamp: new Date(),
            });
          }
        })();

        // NOW leave room (after starting background processing)
        socket.leave(`session-${sessionId}`);
        socket.data.currentSessionId = null;

        // Send success response to client immediately
        callback({ success: true });
      } catch (error) {
        console.error("Error stopping recording:", error);

        if (data.sessionId) {
          await logError(data.sessionId, "STOP_RECORDING_ERROR", error);
        }

        callback({
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to stop recording",
        });
      }
    }
  );

  // Handle disconnection during recording
  socket.on("disconnect", async () => {
    const sessionId = socket.data.currentSessionId;

    if (sessionId) {
      console.log(`Client disconnected during recording: Session ${sessionId}`);

      // Mark session as failed
      await updateSessionStatus(sessionId, "FAILED");
      await logError(
        sessionId,
        "CLIENT_DISCONNECTED",
        new Error("Client disconnected during recording")
      );
    }
  });
}
