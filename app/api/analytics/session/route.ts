import { NextRequest, NextResponse } from "next/server";
import { Queue } from "bullmq";
import type IORedis from "ioredis";

type RedisGlobal = { redisConnection?: IORedis; visitorQueue?: Queue };
type AnalyticsRedisGlobal = RedisGlobal & { analyticsQueueDisabled?: boolean };

function isFatalRedisError(error: Error): boolean {
  return /WRONGPASS|NOAUTH|ENOTFOUND|ECONNREFUSED|invalid username-password/i.test(error.message);
}

function getRedisConnection(): IORedis | null {
  const redisUrl =
    process.env.ANALYTICS_REDIS_URL?.trim() ||
    (process.env.ENABLE_ANALYTICS_REDIS_QUEUE === "true" ? process.env.REDIS_URL?.trim() : "");
  if (!redisUrl) return null;

  const globalForRedis = global as unknown as AnalyticsRedisGlobal;
  if (globalForRedis.analyticsQueueDisabled) return null;

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
      if (isFatalRedisError(err)) {
        globalForRedis.analyticsQueueDisabled = true;
        connection.disconnect();
      }
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
  const globalForRedis = global as unknown as AnalyticsRedisGlobal;
  if (globalForRedis.analyticsQueueDisabled) return null;
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
    const message = error instanceof Error ? error.message : String(error);
    if (isFatalRedisError(new Error(message))) {
      (global as unknown as AnalyticsRedisGlobal).analyticsQueueDisabled = true;
    }
    console.warn("Failed to queue analytics data:", message);
    return NextResponse.json(
      { success: true, queued: false, degraded: true },
      { status: 200 }
    );
  }
}
