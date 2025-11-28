import { addTranscript } from "./sessionService";
// 1. Import Native Google SDK (Best for Audio)
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

// 2. Import Vercel AI SDK (Best for JSON Summaries)
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { Server } from "socket.io";

// --- Configuration ---
const apiKey = process.env.GEMINI_API_KEY || "";

// Setup Native Client (For Audio)
const nativeGenAI = new GoogleGenerativeAI(apiKey);

// Use 1.5-flash (Standard efficient model)
const nativeModel = nativeGenAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  // CRITICAL: Disable safety filters so it doesn't block "bad words" in transcription
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

// Setup Vercel Client (For Summary)
const vercelGoogle = createGoogleGenerativeAI({ apiKey });
const vercelModel = vercelGoogle("gemini-2.5-flash");

// --- Types ---
interface TranscriptionResult {
  text: string;
  confidence?: number;
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

// --- Audio Processing (Using NATIVE SDK for stability) ---
export async function processAudioChunk(
  sessionId: string,
  audioChunk: Buffer | any,
  chunkIndex: number,
  timestamp: number
): Promise<TranscriptionResult> {
  try {
    // 1. ROBUST BUFFER CONVERSION
    let finalBuffer: Buffer;
    if (Buffer.isBuffer(audioChunk)) {
      finalBuffer = audioChunk;
    } else if (Array.isArray(audioChunk)) {
      finalBuffer = Buffer.from(audioChunk);
    } else if (
      audioChunk &&
      audioChunk.type === "Buffer" &&
      Array.isArray(audioChunk.data)
    ) {
      finalBuffer = Buffer.from(audioChunk.data);
    } else {
      finalBuffer = Buffer.from(audioChunk);
    }

    console.log(
      `🔍 [CHUNK ${chunkIndex}] Processing ${finalBuffer.length} bytes`
    );

    // 2. Convert to Base64
    const base64Audio = finalBuffer.toString("base64");

    // 3. Native SDK Call
    const audioPart = {
      inlineData: {
        data: base64Audio,
        mimeType: "audio/webm;codecs=opus",
      },
    };

    const prompt = `
  You are an expert audio transcriber. 
  Task: Transcribe the following audio chunk into clear, readable text.
  
  Guidelines:
  1. ACCURACY: Transcribe exactly what is said, but remove filler words (um, uh, like) and stuttering.
  2. PUNCTUATION: Add proper punctuation and capitalization.
  3. NOISE: Ignore background noises, static, or non-speech sounds.
  4. FORMAT: Return ONLY the raw text. No Markdown. No speaker labels. No timestamps.
`;
    const result = await nativeModel.generateContent([prompt, audioPart]);
    const transcriptionText = result.response.text().trim();

    console.log(`✅ [CHUNK ${chunkIndex}] Gemini: "${transcriptionText}"`);

    // Only save if there is actual text (Gemini sometimes returns empty strings for silence)
    if (transcriptionText.length > 0) {
      await addTranscript(
        sessionId,
        transcriptionText,
        chunkIndex,
        timestamp,
        0.95
      );
    }

    return { text: transcriptionText, confidence: 0.95 };
  } catch (error: any) {
    console.error(`❌ [CHUNK ${chunkIndex}] Audio Error:`, error.message);

    // Optional: Log failure to DB, but don't break the UI
    const fallback = ``; // Return empty string on fail so UI doesn't show "[AUDIO FAILED]"

    return { text: fallback, confidence: 0.0 };
  }
}

// --- Summary Generation (Using VERCEL SDK for structure) ---
export async function generateSummary(
  sessionId: string,
  fullTranscript: string
): Promise<SummaryResult> {
  try {
    if (!fullTranscript || fullTranscript.trim().length < 20) {
      return {
        fullSummary:
          "The recording was too short or empty to generate a summary.",
        keyPoints: [],
        actionItems: [],
        decisions: [],
      };
    }

    console.log(`🧠 Generating summary for session ${sessionId}...`);

    // 4. Vercel AI SDK Call (generateObject)
    const { object } = await generateObject({
      model: vercelModel,
      schema: z.object({
        fullSummary: z
          .string()
          .describe("A concise paragraph summarizing the meeting discussions"),
        keyPoints: z
          .array(z.string())
          .describe("List of main topics discussed"),
        actionItems: z
          .array(z.string())
          .describe(
            "List of tasks assigned, including who is responsible if known"
          ),
        decisions: z
          .array(z.string())
          .describe("List of agreed-upon decisions or conclusions"),
      }),
      prompt : `
  You are an expert AI meeting secretary. Your task is to analyze the provided transcript and extract structured intelligence.

  STRICT INSTRUCTIONS:
  1. Analyze the transcript below.
  2. If the text appears to be random noise, silence, or not a meeting, clearly state that in the "fullSummary".
  3. Output the result purely as a JSON object. Do NOT wrap it in Markdown code blocks (like \`\`\`json).
  4. Follow this exact JSON schema:
  {
    "fullSummary": "A concise executive summary of the discussion (2-3 sentences).",
    "keyPoints": ["List of main topics discussed"],
    "actionItems": ["List of specific tasks assigned (e.g., 'John to email client')"],
    "decisions": ["List of agreed-upon conclusions"]
  }

  TRANSCRIPT:
  "${fullTranscript}"
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
