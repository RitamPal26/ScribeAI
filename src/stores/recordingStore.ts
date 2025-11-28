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
  status: RecordingStatus;
  sessionId: string | null;
  source: RecordingSource;

  startTime: number | null;
  pausedTime: number;
  elapsedTime: number;
  accumulatedTime: number;

  transcriptChunks: TranscriptChunk[];
  fullTranscript: string;

  chunksSent: number;

  error: string | null;

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
  accumulatedTime: 0,

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
      accumulatedTime: 0,
      elapsedTime: 0,
    }),

  pauseTimer: () => {
    const { startTime, accumulatedTime } = get();
    if (startTime) {
      const currentSegment = Date.now() - startTime;
      set({
        startTime: null,
        accumulatedTime: accumulatedTime + currentSegment, // Save progress
      });
    }
  },

  resumeTimer: () => {
    set({ startTime: Date.now() });
  },

  stopTimer: () => {
    set({ startTime: null, accumulatedTime: 0 }); // Freezes elapsed time as is
  },

  updateElapsedTime: () => {
    const { startTime, accumulatedTime } = get();
    if (startTime) {
      const currentSegment = Date.now() - startTime;
      const totalMs = accumulatedTime + currentSegment;
      set({ elapsedTime: Math.floor(totalMs / 1000) });
    }
  },

  addTranscriptChunk: (chunk) =>
    set((state) => {
      const exists = state.transcriptChunks.some(
        (c) => c.chunkIndex === chunk.chunkIndex
      );

      if (exists) {
        return state;
      }

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
      source: "MIC",
      transcriptChunks: [],
      fullTranscript: "",
      chunksSent: 0,
      error: null,
    }),
}));
