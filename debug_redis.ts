import IORedis from 'ioredis';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function debugRedis() {
  const url = process.env.REDIS_URL;
  console.log("Testing Redis URL:", url?.substring(0, 20) + "...");

  const isTls = url?.startsWith('rediss:');
  console.log("Using TLS:", isTls);

  const redis = new IORedis(url!, {
    tls: isTls ? {} : undefined,
    maxRetriesPerRequest: 1
  });

  redis.on('error', (err) => {
    console.error("DEBUG REDIS ERROR:", err.message);
  });

  try {
    console.log("Pinging...");
    const res = await redis.ping();
    console.log("Ping result:", res);
  } catch (err: any) {
    console.error("Ping failed:", err.message);
  } finally {
    redis.disconnect();
  }
}

debugRedis();
