import { NextRequest, NextResponse } from "next/server";
import { Queue } from "bullmq";
import type IORedis from "ioredis";

type RedisGlobal = { redisConnection?: IORedis; visitorQueue?: Queue };

function getRedisConnection(): IORedis | null {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) return null;

  const globalForRedis = global as unknown as RedisGlobal;
  if (globalForRedis.redisConnection) {
    return globalForRedis.redisConnection;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const IORedis = require("ioredis") as typeof import("ioredis").default;
    const connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      tls: redisUrl.startsWith("rediss://") ? {} : undefined,
    });

    connection.on("error", (err: Error) => {
      console.warn("[analytics/session] Redis error (non-fatal):", err.message);
    });

    if (process.env.NODE_ENV !== "production") {
      globalForRedis.redisConnection = connection;
    }
    return connection;
  } catch (error) {
    console.warn("[analytics/session] Redis unavailable:", error);
    return null;
  }
}

function getVisitorQueue(): Queue | null {
  const globalForRedis = global as unknown as RedisGlobal;
  if (globalForRedis.visitorQueue) return globalForRedis.visitorQueue;

  const connection = getRedisConnection();
  if (!connection) return null;

  const queue = new Queue("visitor-analytics", { connection });
  if (process.env.NODE_ENV !== "production") {
    globalForRedis.visitorQueue = queue;
  }
  return queue;
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { sessionId } = data;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const visitorAnalyticsQueue = getVisitorQueue();
    if (!visitorAnalyticsQueue) {
      return NextResponse.json({
        success: true,
        queued: false,
        degraded: true,
        message: "Analytics queue unavailable",
      });
    }

    await visitorAnalyticsQueue.add(
      `session-update-${sessionId}`,
      { sessionId, data },
      { removeOnComplete: true, removeOnFail: 500, attempts: 3 }
    );

    return NextResponse.json({ success: true, queued: true });
  } catch (error) {
    console.error("Failed to queue analytics data:", error);
    return NextResponse.json(
      { success: true, queued: false, degraded: true },
      { status: 200 }
    );
  }
}
