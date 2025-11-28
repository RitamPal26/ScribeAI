import { create } from "zustand";

export type RecordingStatus =
  | "idle"
  | "recording"
  | "paused"
  | "processing"
  | "completed"
  | "error";
export type RecordingSource = "MIC" | "TAB_SHARE";

interface TranscriptChunk {
  chunkIndex: number;
  text: string;
  timestamp: number;
  confidence?: number;
}

interface RecordingState {
  // Recording state
  status: RecordingStatus;
  sessionId: string | null;
  source: RecordingSource;

  // Timer
  startTime: number | null;
  pausedTime: number;
  elapsedTime: number;

  // Transcription
  transcriptChunks: TranscriptChunk[];
  fullTranscript: string;

  // Audio chunks tracking
  chunksSent: number;

  // Error handling
  error: string | null;

  // Actions
  setStatus: (status: RecordingStatus) => void;
  setSessionId: (sessionId: string | null) => void;
  setSource: (source: RecordingSource) => void;

  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  updateElapsedTime: () => void;

  addTranscriptChunk: (chunk: TranscriptChunk) => void;
  clearTranscripts: () => void;

  incrementChunksSent: () => void;

  setError: (error: string | null) => void;
  reset: () => void;
}

export const useRecordingStore = create<RecordingState>((set, get) => ({
  // Initial state
  status: "idle",
  sessionId: null,
  source: "MIC",

  startTime: null,
  pausedTime: 0,
  elapsedTime: 0,

  transcriptChunks: [],
  fullTranscript: "",

  chunksSent: 0,

  error: null,

  // Actions
  setStatus: (status) => {
    console.log("🔄 Store status changing to:", status);
    set({ status });
  },

  setSessionId: (sessionId) => set({ sessionId }),

  setSource: (source) => set({ source }),

  startTimer: () =>
    set({
      startTime: Date.now(),
      pausedTime: 0,
      elapsedTime: 0,
    }),

  pauseTimer: () => {
    const { startTime, pausedTime } = get();
    if (startTime) {
      const elapsed = Date.now() - startTime - pausedTime;
      set({
        pausedTime:
          pausedTime + (Date.now() - startTime - pausedTime - elapsed),
      });
    }
  },

  resumeTimer: () => {
    const { pausedTime } = get();
    set({ startTime: Date.now() - pausedTime });
  },

  stopTimer: () => {
    const { startTime, pausedTime } = get();
    if (startTime) {
      const elapsed = Math.floor((Date.now() - startTime - pausedTime) / 1000);
      set({
        elapsedTime: elapsed,
        startTime: null,
        pausedTime: 0,
      });
    }
  },

  updateElapsedTime: () => {
    const { startTime, pausedTime } = get();
    if (startTime) {
      const elapsed = Math.floor((Date.now() - startTime - pausedTime) / 1000);
      set({ elapsedTime: elapsed });
    }
  },

  // ✅ FIX: Prevent duplicates here
  addTranscriptChunk: (chunk) =>
    set((state) => {
      // 1. Check if we already have this chunkIndex
      const exists = state.transcriptChunks.some(
        (c) => c.chunkIndex === chunk.chunkIndex
      );

      // 2. If it exists, ignore it (return current state)
      if (exists) {
        return state;
      }

      // 3. If new, add it and sort
      const newChunks = [...state.transcriptChunks, chunk].sort(
        (a, b) => a.chunkIndex - b.chunkIndex
      );

      const fullTranscript = newChunks.map((c) => c.text).join(" ");

      return {
        transcriptChunks: newChunks,
        fullTranscript,
      };
    }),

  clearTranscripts: () =>
    set({
      transcriptChunks: [],
      fullTranscript: "",
    }),

  incrementChunksSent: () =>
    set((state) => ({
      chunksSent: state.chunksSent + 1,
    })),

  setError: (error) => set({ error }),

  reset: () =>
    set({
      status: "idle",
      sessionId: null,
      startTime: null,
      pausedTime: 0,
      elapsedTime: 0,
      transcriptChunks: [],
      fullTranscript: "",
      chunksSent: 0,
      error: null,
    }),
}));
