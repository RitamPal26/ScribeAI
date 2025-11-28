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
import { db } from "../db"; // 👈 Use the singleton!

interface StartRecordingData {
  source: "MIC" | "TAB_SHARE";
  title?: string;
}

interface AudioChunkData {
  sessionId: string;
  chunk: number[];
  chunkIndex: number;
  timestamp: number;
}

interface SessionControlData {
  sessionId: string;
}

export function registerRecordingHandlers(io: SocketIOServer, socket: Socket) {
  // Initialize audio service with IO instance
  setSocketIOInstance(io);

  // --- START RECORDING ---
  socket.on("start-recording", async (data, callback) => {
    try {
      const userId = socket.data.userId || socketUser?.id;
      if (!userId) throw new Error("User not authenticated");

      let { source, title, isTabAudio } = data;

      if (!source && isTabAudio) {
        source = "TAB_AUDIO"; // Or whatever your RecordingSource enum value is
      }

      const session = await createSession(userId, source, title);

      const sessionId = session.id;
      socket.data.currentSessionId = sessionId;
      const roomName = `session-${sessionId}`;

      socket.join(roomName);

      if (!socket.rooms.has(roomName)) {
        console.error(
          `❌ Critical: Socket ${socket.id} failed to join ${roomName}`
        );
        throw new Error(`Failed to establish session room connection.`);
      }

      console.log(
        `🎙️ Recording started: Session ${sessionId} by user ${userId} in room ${roomName}`
      );

      socket.to(roomName).emit("recording-status", {
        status: "RECORDING",
        sessionId: sessionId,
        startTime: new Date(),
        title: title,
      });

      callback({
        success: true,
        sessionId: sessionId,
        session: session,
      });
    } catch (error) {
      console.error("❌ Start recording failed:", error);

      // Clean up socket state if we failed halfway through
      delete socket.data.currentSessionId;

      callback({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error starting recording",
      });
    }
  });

  // --- AUDIO CHUNK HANDLER (WITH RECOVERY) ---
  socket.on("audio-chunk", async (data: AudioChunkData, callback) => {
    try {
      const { sessionId, chunk, chunkIndex, timestamp } = data;

      // 1. Session Mismatch & Recovery Check
      if (socket.data.currentSessionId !== sessionId) {
        console.warn(
          `⚠️ Socket memory lost for Session ${sessionId}. Checking DB...`
        );

        const session = await db.recordingSession.findUnique({
          where: { id: sessionId },
          select: { userId: true, status: true },
        });

        // ✅ FIX: Ensure specific user ID source and force String comparison
        const socketUserId = socket.data.userId || socketUser?.id;

        // We use String(...).trim() to handle ObjectId vs String differences
        const isUserMatch =
          String(session?.userId).trim() === String(socketUserId).trim();

        if (
          session &&
          isUserMatch &&
          (session.status === "RECORDING" || session.status === "PAUSED")
        ) {
          console.log(
            `✅ Session recovered! Re-attaching socket to ${sessionId}`
          );

          socket.data.currentSessionId = sessionId;
          socket.data.userId = socketUserId; // Re-save user ID to memory
          socket.join(`session-${sessionId}`);
        } else {
          console.error(
            `❌ Recovery failed. User '${socketUserId}' vs Session User '${session?.userId}'`
          );
          throw new Error("Session ID mismatch or invalid session");
        }
      }

      // ... Rest of your code (Buffer conversion, processing, etc.) remains the same ...
      console.log(`📥 [LIVE] Chunk ${chunkIndex}: ${chunk.length} bytes`);

      const buffer = Buffer.from(new Uint8Array(chunk));

      const transcription = await processAudioChunk(
        sessionId,
        buffer,
        chunkIndex,
        timestamp
      );

      io.to(`session-${sessionId}`).emit("transcription-update", {
        sessionId,
        chunkIndex,
        text: transcription.text,
        timestamp,
        confidence: transcription.confidence || 0.95,
      });

      if (callback) callback({ success: true });
    } catch (error) {
      // ... Error handling remains the same ...
      console.error(`❌ Chunk ${data.chunkIndex} failed:`, error);
      if (callback) callback({ success: false, error: error.message });
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
      const { sessionId, duration } = data;

      try {
        const existingSession = await db.recordingSession.findUnique({
          where: { id: sessionId },
          select: { status: true },
        });

        if (!existingSession) {
          throw new Error("Session not found");
        }

        if (
          existingSession.status === "PROCESSING" ||
          existingSession.status === "COMPLETED"
        ) {
          console.log(`⚠️ Ignored duplicate stop request for ${sessionId}`);
          callback({ success: true }); // Tell client "it's fine" so it stops retrying
          return;
        }

        console.log(
          `🛑 Recording stopped: Session ${sessionId}, Duration: ${duration}s`
        );

        await updateSessionStatus(sessionId, "PROCESSING");
        await updateSessionDuration(sessionId, duration);

        io.to(`session-${sessionId}`).emit("recording-status", {
          status: "PROCESSING",
          sessionId,
          timestamp: new Date(),
        });

        // Background Summary Generation
        (async () => {
          try {
            console.log(
              `🤖 Starting summary generation for session ${sessionId}...`
            );

            // USE SINGLETON DB HERE
            const transcripts = await db.transcript.findMany({
              where: { sessionId },
              orderBy: { chunkIndex: "asc" },
            });

            const fullTranscript = transcripts.map((t) => t.text).join(" ");

            console.log(
              `📝 Full transcript length: ${fullTranscript.length} characters`
            );

            const summaryData = await generateSummary(
              sessionId,
              fullTranscript
            );

            // Transaction ensures consistency
            await db.$transaction(async (tx) => {
              await tx.summary.create({
                data: {
                  sessionId,
                  fullSummary: summaryData.fullSummary,
                  keyPoints: summaryData.keyPoints,
                  actionItems: summaryData.actionItems,
                  decisions: summaryData.decisions,
                },
              });

              await tx.recordingSession.update({
                where: { id: sessionId },
                data: {
                  fullTranscript,
                  status: "COMPLETED",
                },
              });
            });

            console.log(
              `✅ Summary generated and saved for session ${sessionId}`
            );

            io.to(`session-${sessionId}`).emit("recording-status", {
              status: "COMPLETED",
              sessionId,
              timestamp: new Date(),
            });

            io.to(`session-${sessionId}`).emit("summary-generated", {
              sessionId,
              summary: summaryData,
            });
          } catch (summaryError) {
            console.error(
              `❌ Error generating summary for session ${sessionId}:`,
              summaryError
            );

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
        if (data.sessionId)
          await logError(data.sessionId, "STOP_RECORDING_ERROR", error);

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

      try {
        // USE SINGLETON DB
        const currentSession = await db.recordingSession.findUnique({
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
