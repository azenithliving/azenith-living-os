import { NextRequest, NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Setup Redis connection (singleton pattern for Next.js API routes)
const globalForRedis = global as unknown as { redisConnection: IORedis };
const connection = globalForRedis.redisConnection || new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  tls: redisUrl.startsWith('rediss://') ? {} : undefined,
});

if (process.env.NODE_ENV !== 'production') globalForRedis.redisConnection = connection;

// Setup Queue
const visitorAnalyticsQueue = new Queue('visitor-analytics', { connection });

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { sessionId } = data;

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    // Push event to BullMQ Queue for background processing by AACA
    await visitorAnalyticsQueue.add(`session-update-${sessionId}`, {
      sessionId,
      data
    }, {
      removeOnComplete: true,
      removeOnFail: 500,
      attempts: 3
    });

    return NextResponse.json({ success: true, queued: true });
  } catch (error) {
    console.error('Failed to queue analytics data:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
