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

  // --- 1. SEND AUDIO CHUNK (Stable & Fresh State) ---
  const sendAudioChunk = useCallback(async () => {
    // Read fresh state directly to avoid stale closures in setInterval
    const state = useRecordingStore.getState();

    // Safety checks
    if (!state.sessionId || state.status !== "recording") return;

    const currentChunks = chunksBufferRef.current;

    if (currentChunks.length > 0) {
      console.log(
        `📤 Sending chunk #${state.chunksSent} (${currentChunks.length} fragments)`
      );

      const webmBlob = new Blob(currentChunks, {
        type: "audio/webm;codecs=opus",
      });

      // Clear buffer immediately
      chunksBufferRef.current = [];

      const arrayBuffer = await webmBlob.arrayBuffer();
      const rawBytes = new Uint8Array(arrayBuffer);

      try {
        await emit("audio-chunk", {
          sessionId: state.sessionId,
          chunk: rawBytes,
          chunkIndex: state.chunksSent,
          timestamp: state.elapsedTime,
        });

        // Update store
        state.incrementChunksSent();
      } catch (error) {
        console.error("❌ Send error:", error);
      }
    }
  }, [emit]);

  // --- 2. ROBUST CLEANUP HELPER (New) ---
  const cleanupMedia = useCallback(async () => {
    console.log("🧹 Cleaning up media streams...");

    // 1. Stop the interval timer
    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }

    // 2. Stop the MediaRecorder
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    // 3. Stop all audio tracks explicitly (Mic or Tab)
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log(`❌ Track stopped: ${track.label}`);
      });
      audioStreamRef.current = null;
    }

    // 4. Clear buffers
    chunksBufferRef.current = [];
  }, []);

  // --- 3. SOCKET LISTENERS ---
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

    const cleanup = on("transcription-update", handleTranscription);
    return () => {
      if (cleanup) cleanup();
    };
  }, [on, store]);

  useEffect(() => {
    const cleanup = on("recording-status", (data: any) => {
      console.log("📶 Recording status:", data);
      if (data.status) {
        const statusMap: Record<string, any> = {
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

  // --- 4. ELAPSED TIME TIMER ---
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

  // --- 5. PERMISSIONS & STREAMS ---
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      // Immediately stop this test stream
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
      stream.getVideoTracks().forEach((track) => track.stop());
      return new MediaStream([audioTracks[0]]);
    } catch (error: any) {
      if (error.name === "NotAllowedError")
        throw new Error("Screen sharing permission denied");
      if (error.name === "NotFoundError")
        throw new Error("No audio source found.");
      throw new Error("Failed to capture tab audio: " + error.message);
    }
  }

  // --- 6. STOP RECORDING ---
  const stopRecording = useCallback(async () => {
    try {
      console.log("🛑 Stopping recording...");

      // 1. Send whatever is left in the buffer BEFORE cleaning up media
      await sendAudioChunk();

      // 2. Stop Timer in Store
      const state = useRecordingStore.getState();
      store.stopTimer();
      store.setStatus("processing");

      // 3. Tell Backend to stop
      if (state.sessionId) {
        try {
          const response: any = await emit("stop-recording", {
            sessionId: state.sessionId,
            duration: state.elapsedTime,
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
      // ✅ FIX: Nuclear cleanup ensures browser releases the Mic/Tab
      await cleanupMedia();
    }
  }, [emit, store, sendAudioChunk, cleanupMedia]);

  // --- 7. START RECORDING ---
  const startRecording = useCallback(
    async (source: "MIC" | "TAB_SHARE" = "MIC") => {
      try {
        if (!isConnected) throw new Error("Socket not connected");

        let stream: MediaStream | null = null;

        // 🚨 CRITICAL FIX: Get the stream FIRST.
        // If we await cleanupMedia() first, the browser loses the "User Click" context
        // and blocks the "Share Screen" popup.
        if (source === "TAB_SHARE") {
          try {
            stream = await getTabAudioStream();
          } catch (err) {
            // If user cancels screen share, just stop here.
            console.warn("Tab selection cancelled");
            return;
          }
        }

        // ✅ NOW we can safely clean up the old session
        // (This stops the old Mic tracks/recorder)
        await cleanupMedia();

        // If we chose MIC, we get the stream AFTER cleanup
        // (Mic doesn't suffer from the same strict "User Gesture" timeout as Screen Share)
        if (source === "MIC") {
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

        if (!stream) throw new Error("No stream available");

        // Assign the new stream to the Ref so we can track it
        audioStreamRef.current = stream;

        // Handle stream ending (e.g. user clicks "Stop Sharing" in browser UI)
        stream.getAudioTracks()[0].onended = () => {
          if (useRecordingStore.getState().status === "recording") {
            stopRecording();
          }
        };

        const mimeType = MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/ogg";

        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        chunksBufferRef.current = [];

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
          store.setSource(source);
          store.setSessionId(response.sessionId);
          store.setStatus("recording");
          store.startTimer();
          store.clearTranscripts();

          mediaRecorder.start(1000); // Collect data every 1s
          console.log("🎙️ Recording started");

          chunkTimerRef.current = setInterval(() => {
            sendAudioChunk();
          }, CHUNK_DURATION_MS);
        } else {
          throw new Error(response.error);
        }
      } catch (error: any) {
        console.error("Error starting:", error);
        await cleanupMedia();

        store.setSource("MIC");

        store.setError(error.message || "Failed");
        store.setStatus("idle");
      }
    },
    [
      emit,
      store,
      requestPermission,
      isConnected,
      sendAudioChunk,
      stopRecording,
      cleanupMedia,
      getTabAudioStream,
    ]
  );

  // --- 8. PAUSE / RESUME ---
  const pauseRecording = useCallback(async () => {
    const state = useRecordingStore.getState();
    if (!state.sessionId) return;

    if (mediaRecorderRef.current?.state === "recording")
      mediaRecorderRef.current.pause();

    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }

    await emit("pause-recording", { sessionId: state.sessionId });
    store.setStatus("paused");
    store.pauseTimer();
  }, [emit, store]);

  const resumeRecording = useCallback(async () => {
    const state = useRecordingStore.getState();
    if (!state.sessionId) return;

    if (mediaRecorderRef.current?.state === "paused")
      mediaRecorderRef.current.resume();

    chunkTimerRef.current = setInterval(() => {
      sendAudioChunk();
    }, CHUNK_DURATION_MS);

    await emit("resume-recording", { sessionId: state.sessionId });
    store.setStatus("recording");
    store.resumeTimer();
  }, [emit, store, sendAudioChunk]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupMedia(); // ✅ FIX: Clean up on unmount
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [cleanupMedia]);

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
