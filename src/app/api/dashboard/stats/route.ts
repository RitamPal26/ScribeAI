import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch all user sessions
    const allSessions = await prisma.recordingSession.findMany({
      where: { userId },
      select: {
        duration: true,
        status: true,
      },
    });

    // Calculate stats
    const totalSessions = allSessions.length;
    const totalDuration = allSessions.reduce((sum, s) => sum + s.duration, 0);
    const completedSessions = allSessions.filter(
      (s) => s.status === "COMPLETED"
    ).length;

    // Fetch recent 5 sessions
    const recentSessions = await prisma.recordingSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        duration: true,
        status: true,
        createdAt: true,
        source: true,
      },
    });

    return NextResponse.json({
      totalSessions,
      totalDuration,
      completedSessions,
      recentSessions,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
