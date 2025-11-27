import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "./useSocket";
import { useRecordingStore } from "@/stores/recordingStore";

const CHUNK_DURATION_MS = 20000; // 20 seconds

export function useRecording() {
  const { emit, on, isConnected } = useSocket();
  const store = useRecordingStore();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const chunksBufferRef = useRef<Blob[]>([]);
  const chunkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [permissionStatus, setPermissionStatus] = useState<
    "granted" | "denied" | "prompt"
  >("prompt");

  // Listen for transcription updates
  useEffect(() => {
    const cleanup = on("transcription-update", (data: any) => {
      console.log("Transcription update:", data);
      store.addTranscriptChunk({
        chunkIndex: data.chunkIndex,
        text: data.text,
        timestamp: data.timestamp,
        confidence: data.confidence,
      });
    });

    return cleanup;
  }, [on, store]);

  // Listen for recording status updates
  useEffect(() => {
    const cleanup = on("recording-status", (data: any) => {
      console.log("Recording status:", data);
      if (data.status) {
        store.setStatus(data.status.toLowerCase());
      }
    });

    return cleanup;
  }, [on, store]);

  // Timer updater
  useEffect(() => {
    if (store.status === "recording") {
      timerIntervalRef.current = setInterval(() => {
        store.updateElapsedTime();
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [store.status, store]);

  // Request microphone permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Stop the test stream
      stream.getTracks().forEach((track) => track.stop());

      setPermissionStatus("granted");
      return true;
    } catch (error) {
      console.error("Microphone permission denied:", error);
      setPermissionStatus("denied");
      store.setError("Microphone permission denied");
      return false;
    }
  }, [store]);

  // Start recording
  const startRecording = useCallback(
    async (source: "MIC" | "TAB_SHARE" = "MIC") => {
      try {
        console.log("🎤 Starting recording..."); // ← ADD

        if (!isConnected) {
          console.log("❌ Socket not connected"); // ← ADD
          throw new Error("Socket not connected");
        }

        console.log("🎤 Requesting microphone permission..."); // ← ADD
        const hasPermission = await requestPermission();
        if (!hasPermission) {
          console.log("❌ Permission denied"); // ← ADD
          return;
        }

        console.log("🎤 Getting audio stream..."); // ← ADD
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        audioStreamRef.current = stream;

        console.log("🎤 Creating MediaRecorder..."); // ← ADD
        const mimeType = MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/ogg";

        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        chunksBufferRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            console.log("📦 Audio data available:", event.data.size, "bytes"); // ← ADD
            chunksBufferRef.current.push(event.data);
          }
        };

        console.log("🎤 Emitting start-recording event..."); // ← ADD
        const response: any = await emit("start-recording", { source });

        console.log("🎤 Start-recording response:", response); // ← ADD

        if (response.success) {
          console.log("✅ Session created:", response.sessionId); // ← ADD
          store.setSessionId(response.sessionId);
          store.setSource(source);
          store.setStatus("recording");
          store.startTimer();
          store.clearTranscripts();

          // Start recording
          mediaRecorder.start();

          // Set up chunk timer (send every 20 seconds)
          chunkTimerRef.current = setInterval(() => {
            sendAudioChunk();
          }, CHUNK_DURATION_MS);

          console.log("Recording started, session:", response.sessionId);
        }
      } catch (error) {
        console.error("Error starting recording:", error);
        store.setError(
          error instanceof Error ? error.message : "Failed to start recording"
        );
        stopRecording();
      }
    },
    [emit, isConnected, requestPermission, store]
  );

  // Send audio chunk to server
  const sendAudioChunk = useCallback(async () => {
    console.log("📤 sendAudioChunk called");

    if (!mediaRecorderRef.current || !store.sessionId) {
      console.log("❌ No mediaRecorder or sessionId");
      return;
    }

    // Don't stop if already inactive
    if (mediaRecorderRef.current.state === "inactive") {
      console.log("⚠️ MediaRecorder already inactive, skipping");
      return;
    }

    console.log("📤 Requesting data from recorder...");

    // Request data without stopping (uses dataavailable event)
    if (mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.requestData(); // ← USE THIS instead of stop()
    }

    // Wait for data to be available
    setTimeout(async () => {
      console.log("📤 Buffer has", chunksBufferRef.current.length, "chunks");

      if (chunksBufferRef.current.length > 0) {
        const audioBlob = new Blob(chunksBufferRef.current, {
          type: "audio/webm",
        });
        console.log("📤 Created blob:", audioBlob.size, "bytes");

        const arrayBuffer = await audioBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log("📤 Sending chunk to server...");

        try {
          await emit("audio-chunk", {
            sessionId: store.sessionId,
            chunk: Array.from(buffer),
            chunkIndex: store.chunksSent,
            timestamp: store.elapsedTime,
          });

          console.log("✅ Chunk sent successfully");
          store.incrementChunksSent();
        } catch (error) {
          console.error("❌ Error sending chunk:", error);
        }

        // Clear buffer (don't restart recorder, it's still running!)
        chunksBufferRef.current = [];
      }
    }, 100);
  }, [emit, store]);

  // Pause recording
  const pauseRecording = useCallback(async () => {
    try {
      if (!store.sessionId) return;

      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.pause();
      }

      if (chunkTimerRef.current) {
        clearInterval(chunkTimerRef.current);
      }

      await emit("pause-recording", { sessionId: store.sessionId });
      store.setStatus("paused");
      store.pauseTimer();

      console.log("Recording paused");
    } catch (error) {
      console.error("Error pausing recording:", error);
      store.setError(
        error instanceof Error ? error.message : "Failed to pause recording"
      );
    }
  }, [emit, store]);

  // Resume recording
  const resumeRecording = useCallback(async () => {
    try {
      if (!store.sessionId) return;

      if (mediaRecorderRef.current?.state === "paused") {
        mediaRecorderRef.current.resume();
      }

      // Restart chunk timer
      chunkTimerRef.current = setInterval(() => {
        sendAudioChunk();
      }, CHUNK_DURATION_MS);

      await emit("resume-recording", { sessionId: store.sessionId });
      store.setStatus("recording");
      store.resumeTimer();

      console.log("Recording resumed");
    } catch (error) {
      console.error("Error resuming recording:", error);
      store.setError(
        error instanceof Error ? error.message : "Failed to resume recording"
      );
    }
  }, [emit, store, sendAudioChunk]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    try {
      console.log("🛑 Stopping recording...");

      // Send final chunk
      await sendAudioChunk();
      console.log("🛑 Final chunk sent");

      // Stop media recorder
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      }

      // Stop audio stream
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());

      // Clear timers
      if (chunkTimerRef.current) {
        clearInterval(chunkTimerRef.current);
        chunkTimerRef.current = null;
      }

      store.stopTimer();

      // Set processing status
      store.setStatus("processing");
      console.log("🛑 Status set to processing");

      // Notify server
      if (store.sessionId) {
        console.log("🛑 Emitting stop-recording...");

        try {
          const response = await emit("stop-recording", {
            sessionId: store.sessionId,
            duration: store.elapsedTime,
          });

          console.log("🛑 Stop response:", response);

          // If successful, mark as completed immediately
          if (response && response.success) {
            store.setStatus("completed");
            console.log("✅ Recording completed successfully");
          } else {
            store.setStatus("error");
            store.setError("Failed to stop recording");
          }
        } catch (emitError) {
          console.error("❌ Error in stop-recording emit:", emitError);
          store.setStatus("error");
          store.setError("Failed to communicate with server");
        }
      }

      console.log("✅ Recording stopped");
    } catch (error) {
      console.error("Error stopping recording:", error);
      store.setError(
        error instanceof Error ? error.message : "Failed to stop recording"
      );
      store.setStatus("error");
    } finally {
      // Cleanup
      mediaRecorderRef.current = null;
      audioStreamRef.current = null;
      chunksBufferRef.current = [];
    }
  }, [emit, store, sendAudioChunk]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (store.status === "recording" || store.status === "paused") {
        stopRecording();
      }
    };
  }, []);

  return {
    status: store.status,
    sessionId: store.sessionId,
    elapsedTime: store.elapsedTime,
    transcriptChunks: store.transcriptChunks,
    fullTranscript: store.fullTranscript,
    error: store.error,
    permissionStatus,
    isConnected,

    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    requestPermission,
  };
}
