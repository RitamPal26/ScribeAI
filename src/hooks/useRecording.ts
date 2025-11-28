import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "./useSocket";
import { useRecordingStore } from "@/stores/recordingStore";

// UPDATED: Changed to 18 seconds as requested
const CHUNK_DURATION_MS = 18000;

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

  // --- 1. FIXED TRANSCRIPTION LISTENER ---
  // Matches the server event 'transcription-update' and fixes the cleanup logic
  useEffect(() => {
    const handleTranscription = (data: any) => {
      console.log("📥 [UI] Received live transcription:", data.text);
      store.addTranscriptChunk({
        chunkIndex: data.chunkIndex,
        text: data.text,
        timestamp: data.timestamp,
        confidence: data.confidence,
      });
    };

    // Assuming 'on' returns a cleanup function (standard hook pattern)
    // If your useSocket doesn't return a cleanup, you might need store.off(...)
    const cleanup = on("transcription-update", handleTranscription);

    return () => {
      cleanup && cleanup(); // Correct cleanup
    };
  }, [on, store]);

  // Listen for recording status updates
  useEffect(() => {
    const cleanup = on("recording-status", (data: any) => {
      console.log("📶 Recording status:", data);
      if (data.status) {
        store.setStatus(data.status.toLowerCase());
      }
    });
    return cleanup;
  }, [on, store]);

  // UI Timer updater
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
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
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
      stream.getTracks().forEach((track) => track.stop());
      setPermissionStatus("granted");
      return true;
    } catch (error) {
      console.error("❌ Microphone permission denied:", error);
      setPermissionStatus("denied");
      store.setError("Microphone permission denied");
      return false;
    }
  }, [store]);

  async function getTabAudioStream(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error('No audio track. Check "Share audio".');
      }
      const audioOnlyStream = new MediaStream([audioTracks[0]]);
      stream.getVideoTracks().forEach((track) => track.stop());
      return audioOnlyStream;
    } catch (error: any) {
      if (error.name === "NotAllowedError")
        throw new Error("Screen sharing permission denied");
      if (error.name === "NotFoundError")
        throw new Error("No audio source found.");
      throw new Error("Failed to capture tab audio: " + error.message);
    }
  }

  // --- 2. UPDATED SEND AUDIO CHUNK ---
  // Since we use start(1000), we don't need requestData() here.
  // We just empty the buffer that is filling up automatically.
  const sendAudioChunk = useCallback(async () => {
    // Safety check: Don't send if we aren't recording
    if (!store.sessionId || store.status !== "recording") return;

    const currentChunks = chunksBufferRef.current;

    if (currentChunks.length > 0) {
      console.log(
        `📤 Sending chunk #${store.chunksSent} (${currentChunks.length} fragments)`
      );

      // Create Blob
      const webmBlob = new Blob(currentChunks, {
        type: "audio/webm;codecs=opus",
      });

      // Clear buffer IMMEDIATELY to start collecting next chunk
      chunksBufferRef.current = [];

      // Convert and Emit
      const arrayBuffer = await webmBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      try {
        await emit("audio-chunk", {
          sessionId: store.sessionId,
          chunk: Array.from(new Uint8Array(buffer)),
          chunkIndex: store.chunksSent,
          timestamp: store.elapsedTime,
        });
        store.incrementChunksSent();
      } catch (error) {
        console.error("❌ Send error:", error);
      }
    }
  }, [emit, store]);

  // --- STOP RECORDING ---
  const stopRecording = useCallback(async () => {
    try {
      console.log("🛑 Stopping recording...");

      // Send whatever is left in the buffer
      await sendAudioChunk();

      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop();
      }
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());

      if (chunkTimerRef.current) {
        clearInterval(chunkTimerRef.current);
        chunkTimerRef.current = null;
      }

      store.stopTimer();
      store.setStatus("processing");

      if (store.sessionId) {
        try {
          const response = await emit("stop-recording", {
            sessionId: store.sessionId,
            duration: store.elapsedTime,
          });
          if (response && response.success) {
            store.setStatus("completed");
          } else {
            store.setStatus("error");
          }
        } catch (e) {
          console.error(e);
        }
      }
    } catch (error) {
      console.error("Error stopping:", error);
      store.setStatus("error");
    } finally {
      mediaRecorderRef.current = null;
      audioStreamRef.current = null;
      chunksBufferRef.current = [];
    }
  }, [emit, store, sendAudioChunk]);

  // --- 3. UPDATED START RECORDING ---
  const startRecording = useCallback(
    async (source: "MIC" | "TAB_SHARE" = "MIC") => {
      try {
        if (!isConnected) throw new Error("Socket not connected");

        let stream: MediaStream;
        if (source === "TAB_SHARE") {
          stream = await getTabAudioStream();
        } else {
          const hasPermission = await requestPermission();
          if (!hasPermission) return;
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          });
        }

        audioStreamRef.current = stream;

        // Handle stream ending (user clicks "Stop Sharing" in browser UI)
        stream.getAudioTracks()[0].addEventListener("ended", () => {
          if (store.status === "recording") stopRecording();
        });

        const mimeType = MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/ogg";
        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        chunksBufferRef.current = [];

        // Simple data collection - fires every 1s due to start(1000)
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksBufferRef.current.push(event.data);
          }
        };

        const response: any = await emit("start-recording", { source });

        if (response.success) {
          store.setSessionId(response.sessionId);
          store.setSource(source);
          store.setStatus("recording");
          store.startTimer();
          store.clearTranscripts();

          // CRITICAL CHANGE: start(1000)
          // This splits audio into 1-second blobs automatically.
          // This makes the buffer logic much smoother than manual requestData()
          mediaRecorder.start(1000);
          console.log("🎙️ Recording started (1s timeslice)");

          // CRITICAL CHANGE: Single Timer Logic
          // We removed the conflicting setTimeout.
          // This interval fires every 18s.
          chunkTimerRef.current = setInterval(() => {
            // We check status to be safe, though clearInterval should handle it
            if (store.status === "recording") {
              sendAudioChunk();
            }
          }, CHUNK_DURATION_MS);
        } else {
          throw new Error(response.error);
        }
      } catch (error) {
        console.error("Error starting:", error);
        audioStreamRef.current?.getTracks().forEach((t) => t.stop());
        store.setError(error instanceof Error ? error.message : "Failed");
        store.setStatus("idle");
      }
    },
    [emit, store, requestPermission, isConnected, sendAudioChunk, stopRecording]
  );

  const pauseRecording = useCallback(async () => {
    if (!store.sessionId) return;
    if (mediaRecorderRef.current?.state === "recording")
      mediaRecorderRef.current.pause();
    if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);

    await emit("pause-recording", { sessionId: store.sessionId });
    store.setStatus("paused");
    store.pauseTimer();
  }, [emit, store]);

  const resumeRecording = useCallback(async () => {
    if (!store.sessionId) return;
    if (mediaRecorderRef.current?.state === "paused")
      mediaRecorderRef.current.resume();

    chunkTimerRef.current = setInterval(() => {
      if (store.status === "recording") sendAudioChunk();
    }, CHUNK_DURATION_MS);

    await emit("resume-recording", { sessionId: store.sessionId });
    store.setStatus("recording");
    store.resumeTimer();
  }, [emit, store, sendAudioChunk]);

  useEffect(() => {
    return () => {
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
      // Optional: stop recording on unmount
      if (store.status === "recording") stopRecording();
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
