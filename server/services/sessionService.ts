import { SessionStatus, RecordingSource } from "@prisma/client";
import { db } from "../db";

export async function createSession(
  userId: string,
  source: RecordingSource = RecordingSource.MIC,
  title?: string
) {
  const defaultTitle =
    title ||
    `Recording - ${new Date().toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;

  const session = await db.recordingSession.create({
    data: {
      userId,
      source,
      title: defaultTitle,
      status: SessionStatus.RECORDING,
      recordingStartedAt: new Date(),
    },
  });

  return session;
}

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus
) {
  const updateData: any = { status };

  // Set recordingEndedAt if we are stopping/finishing
  if (
    status === SessionStatus.PROCESSING ||
    status === SessionStatus.COMPLETED ||
    status === SessionStatus.FAILED
  ) {
    updateData.recordingEndedAt = new Date();
  }

  return await db.recordingSession.update({
    where: { id: sessionId },
    data: updateData,
  });
}

export async function updateSessionDuration(
  sessionId: string,
  duration: number
) {
  return await db.recordingSession.update({
    where: { id: sessionId },
    data: { duration: Math.floor(duration) },
  });
}

export async function addTranscript(
  sessionId: string,
  text: string,
  chunkIndex: number,
  timestamp: number,
  confidence?: number,
  speakerId?: string
) {
  return await db.transcript.create({
    data: {
      sessionId,
      text,
      chunkIndex,
      timestamp,
      confidence,
      speakerId,
    },
  });
}

export async function finalizeSession(sessionId: string) {
  const transcripts = await db.transcript.findMany({
    where: { sessionId },
    orderBy: { chunkIndex: "asc" },
  });

  const fullTranscript = transcripts.map((t) => t.text).join(" ");

  return await db.recordingSession.update({
    where: { id: sessionId },
    data: {
      fullTranscript,
      status: SessionStatus.COMPLETED,
    },
  });
}

export async function logError(
  sessionId: string,
  errorType: string,
  error: Error | unknown
) {
  const message = error instanceof Error ? error.message : String(error);
  const stackTrace = error instanceof Error ? error.stack : undefined;

  try {
    return await db.errorLog.create({
      data: {
        sessionId,
        errorType,
        message,
        stackTrace,
      },
    });
  } catch (e) {
    console.error(
      "Failed to write to ErrorLog (DB Connection likely lost):",
      e
    );
  }
}

export async function getSessionById(sessionId: string) {
  return await db.recordingSession.findUnique({
    where: { id: sessionId },
    include: {
      transcripts: {
        orderBy: { chunkIndex: "asc" },
      },
      summary: true,
      errorLogs: true,
    },
  });
}

export async function getUserSessions(userId: string) {
  return await db.recordingSession.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { transcripts: true },
      },
    },
  });
}
