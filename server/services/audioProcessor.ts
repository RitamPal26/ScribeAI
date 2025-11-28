import { addTranscript } from "./sessionService";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { Server } from "socket.io";

const apiKey = process.env.GEMINI_API_KEY || "";

const MODEL_NAME = "gemini-2.5-flash";

const nativeGenAI = new GoogleGenerativeAI(apiKey);

const nativeModel = nativeGenAI.getGenerativeModel({
  model: MODEL_NAME,
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
  ],
});

const vercelGoogle = createGoogleGenerativeAI({ apiKey });
const vercelModel = vercelGoogle("gemini-2.5-flash");

// --- Types ---
interface TranscriptionResult {
  text: string;
  confidence?: number;
  isPartial?: boolean;
}

interface SummaryResult {
  fullSummary: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
}

let io: Server | null = null;

export function setSocketIOInstance(socketIOInstance: Server) {
  io = socketIOInstance;
}

export async function processAudioChunk(
  sessionId: string,
  audioChunk: Buffer | any,
  chunkIndex: number,
  timestamp: number
): Promise<TranscriptionResult> {
  try {
    let finalBuffer: Buffer;

    // Fast buffer conversion
    if (Buffer.isBuffer(audioChunk)) {
      finalBuffer = audioChunk;
    } else if (Array.isArray(audioChunk)) {
      finalBuffer = Buffer.from(audioChunk);
    } else if (
      audioChunk?.type === "Buffer" &&
      Array.isArray(audioChunk.data)
    ) {
      finalBuffer = Buffer.from(audioChunk.data);
    } else {
      finalBuffer = Buffer.from(audioChunk);
    }

    const base64Audio = finalBuffer.toString("base64");

    const audioPart = {
      inlineData: {
        data: base64Audio,
        mimeType: "audio/webm;codecs=opus",
      },
    };

    // ⚡ OPTIMIZATION 4: Optimized System Prompt for Speed & Conciseness
    const prompt = `
    Task: Transcribe this audio fragment.
    Rules:
    - Output ONLY the spoken text.
    - Do not add "Here is the transcription".
    - If silence, output nothing.
    - This is part of a live stream, do not hallucinate endings.
    `;

    // Await the API call (Network Bottleneck - unavoidable unless using WebSockets)
    const result = await nativeModel.generateContent([prompt, audioPart]);
    const transcriptionText = result.response.text().trim();

    if (transcriptionText.length > 0) {
      console.log(`✅ [CHUNK ${chunkIndex}] "${transcriptionText}"`);

      addTranscript(
        sessionId,
        transcriptionText,
        chunkIndex,
        timestamp,
        0.95
      ).catch((err) =>
        console.error(`⚠️ DB Save Failed for chunk ${chunkIndex}:`, err)
      );

      // If you have the socket instance here, emit directly to save a round trip
      if (io) {
        io.to(sessionId).emit("transcription_update", {
          text: transcriptionText,
          chunkIndex,
        });
      }
    }

    return { text: transcriptionText, confidence: 0.95 };
  } catch (error: any) {
    console.error(`❌ [CHUNK ${chunkIndex}] Audio Error:`, error.message);
    return { text: "", confidence: 0.0 };
  }
}

// --- Summary Generation ---
export async function generateSummary(
  sessionId: string,
  fullTranscript: string
): Promise<SummaryResult> {
  try {
    if (!fullTranscript || fullTranscript.trim().length < 20) {
      return {
        fullSummary: "The recording was too short.",
        keyPoints: [],
        actionItems: [],
        decisions: [],
      };
    }

    // console.log(`🧠 Generating summary...`);

    const { object } = await generateObject({
      model: vercelModel,
      schema: z.object({
        fullSummary: z.string(),
        keyPoints: z.array(z.string()),
        actionItems: z.array(z.string()),
        decisions: z.array(z.string()),
      }),
      prompt: `
      Analyze this meeting transcript.
      TRANSCRIPT: "${fullTranscript}"
      `,
    });

    return object;
  } catch (error) {
    console.error("Error generating summary:", error);
    return {
      fullSummary: "Failed to generate summary.",
      keyPoints: [],
      actionItems: [],
      decisions: [],
    };
  }
}
