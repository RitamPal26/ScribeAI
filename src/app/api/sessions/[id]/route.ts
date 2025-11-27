import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ← Changed to Promise
) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: sessionId } = await params; // ← AWAIT params

    // Verify session belongs to user
    const recordingSession = await prisma.recordingSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    if (!recordingSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (recordingSession.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Delete session (cascades to transcripts, summary, errorLogs)
    await prisma.recordingSession.delete({
      where: { id: sessionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting session:", error);
    return NextResponse.json(
      { error: "Failed to delete session" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ← Changed to Promise
) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: sessionId } = await params; // ← AWAIT params

    // Fetch session with all details
    const recordingSession = await prisma.recordingSession.findUnique({
      where: { id: sessionId },
      include: {
        transcripts: {
          orderBy: { chunkIndex: "asc" },
        },
        summary: true,
        errorLogs: true,
      },
    });

    if (!recordingSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (recordingSession.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ session: recordingSession });
  } catch (error) {
    console.error("Error fetching session:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: sessionId } = await params;
    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Invalid title' },
        { status: 400 }
      );
    }

    // Verify session belongs to user
    const recordingSession = await prisma.recordingSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    if (!recordingSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (recordingSession.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Update title
    const updatedSession = await prisma.recordingSession.update({
      where: { id: sessionId },
      data: { title: title.trim() },
    });

    return NextResponse.json({ session: updatedSession });

  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
