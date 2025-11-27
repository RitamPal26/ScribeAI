import { addTranscript } from './sessionService';

interface TranscriptionResult {
  text: string;
  confidence?: number;
  speakerId?: string;
}

/**
 * Process audio chunk and return transcription
 * TODO: Integrate with Gemini API on Day 2
 * For now, returns mock transcription
 */
export async function processAudioChunk(
  sessionId: string,
  audioChunk: Buffer,
  chunkIndex: number,
  timestamp: number
): Promise<TranscriptionResult> {
  try {
    console.log(`Processing audio chunk ${chunkIndex} for session ${sessionId}`);
    console.log(`Chunk size: ${audioChunk.length} bytes, Timestamp: ${timestamp}s`);

    // TODO: Day 2 - Send to Gemini API for actual transcription
    // const transcription = await transcribeWithGemini(audioChunk);

    // Mock transcription for testing
    const mockText = `This is a test transcription for chunk ${chunkIndex}. `;
    const mockConfidence = 0.85 + Math.random() * 0.15; // 0.85-1.0

    // Save transcript to database
    await addTranscript(
      sessionId,
      mockText,
      chunkIndex,
      timestamp,
      mockConfidence
    );

    console.log('✅ Transcript saved to DB');

    return {
      text: mockText,
      confidence: mockConfidence,
    };

  } catch (error) {
    console.error('Error processing audio chunk:', error);
    throw error;
  }
}

/**
 * Convert audio buffer to format suitable for Gemini API
 * TODO: Implement on Day 2
 */
export function prepareAudioForGemini(audioBuffer: Buffer): Buffer {
  // WebM to format conversion if needed
  // For now, return as-is
  return audioBuffer;
}

/**
 * Validate audio chunk format and size
 */
export function validateAudioChunk(chunk: Buffer): boolean {
  const MAX_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
  
  if (chunk.length === 0) {
    throw new Error('Empty audio chunk');
  }
  
  if (chunk.length > MAX_CHUNK_SIZE) {
    throw new Error(`Audio chunk too large: ${chunk.length} bytes`);
  }
  
  return true;
}
