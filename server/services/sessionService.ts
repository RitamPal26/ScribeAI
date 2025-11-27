import { PrismaClient, SessionStatus, RecordingSource } from '@prisma/client';

const prisma = new PrismaClient();

export async function createSession(
  userId: string,
  source: RecordingSource = 'MIC',
  title?: string
) {
  const defaultTitle = title || `Recording - ${new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  const session = await prisma.recordingSession.create({ // ← CHANGED
    data: {
      userId,
      source,
      title: defaultTitle,
      status: 'RECORDING',
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

  if (status === 'PROCESSING' || status === 'COMPLETED' || status === 'FAILED') {
    updateData.recordingEndedAt = new Date();
  }

  return await prisma.recordingSession.update({ // ← CHANGED
    where: { id: sessionId },
    data: updateData,
  });
}

export async function updateSessionDuration(
  sessionId: string,
  duration: number
) {
  return await prisma.recordingSession.update({ // ← CHANGED
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
  return await prisma.transcript.create({
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
  const transcripts = await prisma.transcript.findMany({
    where: { sessionId },
    orderBy: { chunkIndex: 'asc' },
  });

  const fullTranscript = transcripts.map(t => t.text).join(' ');

  return await prisma.recordingSession.update({ // ← CHANGED
    where: { id: sessionId },
    data: {
      fullTranscript,
      status: 'COMPLETED',
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

  return await prisma.errorLog.create({
    data: {
      sessionId,
      errorType,
      message,
      stackTrace,
    },
  });
}

export async function getSessionById(sessionId: string) {
  return await prisma.recordingSession.findUnique({ // ← CHANGED
    where: { id: sessionId },
    include: {
      transcripts: {
        orderBy: { chunkIndex: 'asc' },
      },
      summary: true,
      errorLogs: true,
    },
  });
}

export async function getUserSessions(userId: string) {
  return await prisma.recordingSession.findMany({ // ← CHANGED
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { transcripts: true },
      },
    },
  });
}
