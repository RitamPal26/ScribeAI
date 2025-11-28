import { Server as SocketIOServer, Socket } from "socket.io";
import {
  createSession,
  updateSessionStatus,
  updateSessionDuration,
  logError,
} from "../services/sessionService";
import {
  processAudioChunk,
  generateSummary,
  setSocketIOInstance,
} from "../services/audioProcessor";
import { PrismaClient } from "@prisma/client";

interface StartRecordingData {
  source: "MIC" | "TAB_SHARE";
  title?: string;
}

// UPDATE: Chunk comes as number[] from client's Array.from(Uint8Array)
interface AudioChunkData {
  sessionId: string;
  chunk: number[];
  chunkIndex: number;
  timestamp: number;
}

interface SessionControlData {
  sessionId: string;
}

const prisma = new PrismaClient();

export function registerRecordingHandlers(io: SocketIOServer, socket: Socket) {
  // Initialize audio service with IO instance for potential callbacks
  setSocketIOInstance(io);

  // --- START RECORDING ---
  socket.on("start-recording", async (data: StartRecordingData, callback) => {
    try {
      const userId = socket.data.userId;
      const { source, title } = data;

      const session = await createSession(userId, source, title);

      socket.join(`session-${session.id}`);
      socket.data.currentSessionId = session.id;

      console.log(
        `🎙️ Recording started: Session ${session.id} by user ${userId}`
      );

      callback({
        success: true,
        sessionId: session.id,
        session,
      });

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

  // --- AUDIO CHUNK HANDLER (ADDED) ---
  socket.on("audio-chunk", async (data: AudioChunkData, callback) => {
    try {
      const { sessionId, chunk, chunkIndex, timestamp } = data;

      // 1. Security Check
      if (socket.data.currentSessionId !== sessionId) {
        console.warn(
          `⚠️ Session mismatch: Socket ${socket.data.currentSessionId} vs Chunk ${sessionId}`
        );
        throw new Error("Session ID mismatch");
      }

      console.log(
        `📥 [LIVE] Chunk ${chunkIndex}: ${chunk.length} bytes (Session: ${sessionId})`
      );

      // 2. Convert Array back to Buffer
      // The client sends a regular array (from Uint8Array), Node needs a Buffer
      const buffer = Buffer.from(new Uint8Array(chunk));

      // 3. Process audio (STT Service)
      const transcription = await processAudioChunk(
        sessionId,
        buffer,
        chunkIndex,
        timestamp
      );

      // 4. Broadcast result to client
      // Event name must match client's 'useRecording' hook: "transcription-update"
      io.to(`session-${sessionId}`).emit("transcription-update", {
        sessionId,
        chunkIndex,
        text: transcription.text,
        timestamp,
        confidence: transcription.confidence || 0.95,
      });

      console.log(`📤 [LIVE] Emitted transcription for chunk ${chunkIndex}`);

      // 5. Acknowledge receipt
      if (callback) callback({ success: true });
    } catch (error) {
      console.error(`❌ Chunk ${data.chunkIndex} failed:`, error);

      // Log error to DB but don't crash
      if (data.sessionId) {
        await logError(data.sessionId, "AUDIO_PROCESSING_ERROR", error);
      }

      // Notify client logic of failure (optional, but good practice)
      if (callback) {
        callback({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to process audio chunk",
        });
      }
    }
  });

  // --- PAUSE RECORDING ---
  socket.on("pause-recording", async (data: SessionControlData, callback) => {
    try {
      const { sessionId } = data;
      await updateSessionStatus(sessionId, "PAUSED");

      console.log(`⏸️ Recording paused: Session ${sessionId}`);

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

  // --- RESUME RECORDING ---
  socket.on("resume-recording", async (data: SessionControlData, callback) => {
    try {
      const { sessionId } = data;
      await updateSessionStatus(sessionId, "RECORDING");

      console.log(`▶️ Recording resumed: Session ${sessionId}`);

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

  // --- STOP RECORDING ---
  socket.on(
    "stop-recording",
    async (data: SessionControlData & { duration: number }, callback) => {
      try {
        const { sessionId, duration } = data;

        console.log(
          `🛑 Recording stopped: Session ${sessionId}, Duration: ${duration}s`
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

            // Mark as completed even if summary fails (so UI doesn't hang)
            await updateSessionStatus(sessionId, "COMPLETED");
            await logError(sessionId, "SUMMARY_GENERATION_ERROR", summaryError);

            io.to(`session-${sessionId}`).emit("recording-status", {
              status: "COMPLETED",
              sessionId,
              timestamp: new Date(),
            });
          }
        })();

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

  // --- DISCONNECT ---
  socket.on("disconnect", async () => {
    const sessionId = socket.data.currentSessionId;

    if (sessionId) {
      console.log(
        `⚠️ Client disconnected during recording: Session ${sessionId}`
      );

      // Only mark failed if it was actively recording,
      // avoiding overwriting COMPLETED status if they disconnect right after stop
      try {
        const currentSession = await prisma.recordingSession.findUnique({
          where: { id: sessionId },
        });
        if (
          currentSession?.status === "RECORDING" ||
          currentSession?.status === "PAUSED"
        ) {
          await updateSessionStatus(sessionId, "FAILED");
          await logError(
            sessionId,
            "CLIENT_DISCONNECTED",
            new Error("Client disconnected during active recording")
          );
        }
      } catch (e) {
        console.error("Error handling disconnect", e);
      }
    }
  });
}
