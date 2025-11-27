import { addTranscript } from "./sessionService";
import { GoogleGenerativeAI } from "@google/generative-ai";

interface TranscriptionResult {
  text: string;
  confidence?: number;
  speakerId?: string;
}

// Initialize Gemini AI
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn(
    "⚠️ Warning: GEMINI_API_KEY is not set in environment variables."
  );
}
const genAI = new GoogleGenerativeAI(apiKey || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-002" });

/**
 * Process audio chunk and return transcription using Gemini API
 */
export async function processAudioChunk(
  sessionId: string,
  audioChunk: Buffer,
  chunkIndex: number,
  timestamp: number
): Promise<TranscriptionResult> {
  try {
    console.log(
      `Processing audio chunk ${chunkIndex} for session ${sessionId}`
    );
    console.log(
      `Chunk size: ${audioChunk.length} bytes, Timestamp: ${timestamp}s`
    );

    // ADD THESE DEBUG LOGS:
    console.log("🔍 First 50 bytes:", audioChunk.slice(0, 50).toString("hex"));
    console.log("🔍 Checking if valid WAV header...");

    // Check for WAV header (should start with "RIFF")
    const header = audioChunk.slice(0, 4).toString("ascii");
    console.log("🔍 Audio header:", header);

    if (header !== "RIFF") {
      console.warn("⚠️ Not a valid WAV file! Header:", header);
    }

    // Validate chunk
    validateAudioChunk(audioChunk);

    // Convert buffer to base64 for Gemini
    const base64Audio = audioChunk.toString("base64");

    // Prepare audio for Gemini API
    const audioPart = {
      inlineData: {
        data: base64Audio,
        mimeType: "audio/wav", // Browser records in WebM format
      },
    };

    // Create transcription prompt
    const prompt = `Transcribe this audio clip accurately. 
    
Rules:
- Return ONLY the transcription text, no additional commentary
- If multiple speakers are detected, use "Speaker 1:", "Speaker 2:" labels
- If audio is unclear or silent, return "[UNCLEAR]" or "[SILENCE]"
- Maintain proper punctuation and capitalization
- Do not add any explanations or metadata

Transcription:`;

    console.log(`📤 Sending chunk ${chunkIndex} to Gemini API...`);

    // Call Gemini API with timeout
    const result = (await Promise.race([
      model.generateContent([prompt, audioPart]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Gemini API timeout")), 30000)
      ),
    ])) as any;

    const response = result.response;
    const transcriptionText = response.text().trim();

    console.log(
      `✅ Gemini transcription for chunk ${chunkIndex}:`,
      transcriptionText.substring(0, 100)
    );

    // Calculate mock confidence (Gemini doesn't provide this directly)
    const confidence = transcriptionText.length > 0 ? 0.9 : 0.5;

    // Save transcript to database
    await addTranscript(
      sessionId,
      transcriptionText,
      chunkIndex,
      timestamp,
      confidence
    );

    console.log("✅ Transcript saved to DB");

    return {
      text: transcriptionText,
      confidence,
    };
  } catch (error) {
    console.error("❌ Error processing audio chunk:", error);

    // Fallback to mock transcription on error
    const fallbackText = `[Transcription failed for chunk ${chunkIndex}]`;

    // Note: We use 0.0 confidence to indicate failure
    await addTranscript(sessionId, fallbackText, chunkIndex, timestamp, 0.0);

    return {
      text: fallbackText,
      confidence: 0.0,
    };
  }
}

/**
 * Generate summary from full transcript using Gemini
 */
export async function generateSummary(
  sessionId: string,
  fullTranscript: string
): Promise<{
  fullSummary: string;
  keyPoints: string[];
  actionItems: string[];
  decisions: string[];
}> {
  try {
    console.log(`📝 Generating summary for session ${sessionId}...`);

    const summaryPrompt = `Analyze the following transcript and provide a structured summary.

Transcript:
${fullTranscript}

Provide your response in the following JSON format (return ONLY valid JSON, no additional text):
{
  "fullSummary": "A comprehensive 2-3 sentence summary of the main topics discussed",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "actionItems": ["Action item 1", "Action item 2"],
  "decisions": ["Decision 1", "Decision 2"]
}

Rules:
- If no action items exist, return empty array
- If no decisions were made, return empty array
- Keep key points concise (1 sentence each)
- Return ONLY the JSON object, nothing else`;

    // Added generation config to encourage JSON output
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: summaryPrompt }] }],
      generationConfig: { responseMimeType: "application/json" },
    });

    const response = result.response.text().trim();

    console.log("📝 Raw Gemini summary response:", response.substring(0, 200));

    // Parse JSON response
    let summaryData;
    try {
      // FIX: Corrected the regex logic to clean markdown code blocks
      const jsonText = response
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      summaryData = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("❌ Failed to parse Gemini JSON response:", parseError);

      // Fallback summary structure
      summaryData = {
        fullSummary: response.substring(0, 500),
        keyPoints: ["Summary generation encountered parsing issues"],
        actionItems: [],
        decisions: [],
      };
    }

    console.log("✅ Summary generated successfully");

    return summaryData;
  } catch (error) {
    console.error("❌ Error generating summary:", error);

    // Return fallback summary
    return {
      fullSummary:
        "Summary generation failed. Please review the transcript manually.",
      keyPoints: ["Error generating summary"],
      actionItems: [],
      decisions: [],
    };
  }
}

/**
 * Validate audio chunk format and size
 */
export function validateAudioChunk(chunk: Buffer): boolean {
  const MAX_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

  if (chunk.length === 0) {
    throw new Error("Empty audio chunk");
  }

  if (chunk.length > MAX_CHUNK_SIZE) {
    throw new Error(`Audio chunk too large: ${chunk.length} bytes`);
  }

  return true;
}
