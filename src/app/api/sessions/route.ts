import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
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

    const userId = session.user.id;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build where clause
    const where: any = {
      userId,
    };

    if (search) {
      where.title = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    // Fetch sessions
    const sessions = await prisma.recordingSession.findMany({
      where,
      orderBy: {
        [sortBy]: sortOrder,
      },
      include: {
        _count: {
          select: {
            transcripts: true,
          },
        },
        summary: {
          select: {
            id: true,
          },
        },
      },
    });

    return NextResponse.json({ sessions });

  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
