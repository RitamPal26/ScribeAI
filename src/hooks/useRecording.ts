import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "./useSocket";
import { useRecordingStore } from "@/stores/recordingStore";

const CHUNK_DURATION_MS = 5000;

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

  // --- 1. SEND AUDIO CHUNK (Fixed: Moved into a function) ---
  const sendAudioChunk = useCallback(async () => {
    // Safety checks
    if (!store.sessionId || store.status !== "recording") return;

    const currentChunks = chunksBufferRef.current;

    if (currentChunks.length > 0) {
      console.log(
        `📤 Sending chunk #${store.chunksSent} (${currentChunks.length} fragments)`
      );

      // Create a single Blob from the accumulated 1-second slices
      const webmBlob = new Blob(currentChunks, {
        type: "audio/webm;codecs=opus",
      });

      // Clear buffer immediately to prevent double-sending
      chunksBufferRef.current = [];

      const arrayBuffer = await webmBlob.arrayBuffer();

      // FIX: 'Buffer' is not available in the browser. Use Uint8Array.
      // Socket.io handles Uint8Array perfectly.
      const rawBytes = new Uint8Array(arrayBuffer);

      try {
        await emit("audio-chunk", {
          sessionId: store.sessionId,
          chunk: rawBytes, // Send raw browser bytes
          chunkIndex: store.chunksSent,
          timestamp: store.elapsedTime,
        });
        store.incrementChunksSent();
      } catch (error) {
        console.error("❌ Send error:", error);
        // Optional: Push chunks back to buffer if failed?
        // For now, we log it to avoid memory leaks.
      }
    }
  }, [
    store.sessionId,
    store.status,
    store.chunksSent,
    store.elapsedTime,
    emit,
    store,
  ]);

  // --- 2. SOCKET LISTENERS ---
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

    // Use the cleanup function returned by 'on'
    const cleanup = on("transcription-update", handleTranscription);

    return () => {
      cleanup && cleanup();
    };
  }, [on, store]);

  useEffect(() => {
    const cleanup = on("recording-status", (data: any) => {
      console.log("📶 Recording status:", data);
      if (data.status) {
        // Map backend status to frontend status if needed, or use directly
        const statusMap: Record<string, string> = {
          RECORDING: "recording",
          PAUSED: "paused",
          COMPLETED: "completed",
          PROCESSING: "processing",
        };
        store.setStatus(statusMap[data.status] || "idle");
      }
    });
    return cleanup;
  }, [on, store]);

  // --- 3. ELAPSED TIME TIMER ---
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

  // --- 4. PERMISSIONS & STREAMS ---
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      // We just wanted to check permission, so we stop this test stream immediately
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
        video: true, // DisplayMedia requires video: true primarily
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

      // We don't need the video track, stop it to save resources
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

  // --- 5. STOP RECORDING ---
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
          const response: any = await emit("stop-recording", {
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
  }, [emit, store, sendAudioChunk]); // Added sendAudioChunk dependency

  // --- 6. START RECORDING ---
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

        // Collect data
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksBufferRef.current.push(event.data);
          }
        };

        const response: any = await emit("start-recording", {
          source,
          title: "New Recording",
        });

        if (response.success) {
          store.setSessionId(response.sessionId);
          store.setSource(source);
          store.setStatus("recording");
          store.startTimer();
          store.clearTranscripts();

          // Slice audio every 1000ms (1 second)
          mediaRecorder.start(1000);
          console.log("🎙️ Recording started (1s timeslice)");

          // Send accumulated chunks every 5 seconds
          chunkTimerRef.current = setInterval(() => {
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

  // --- 7. PAUSE / RESUME ---
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
      // Optional: don't automatically stop on unmount if you want background recording,
      // but usually safer to stop.
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
