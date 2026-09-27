import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Short critical section per key (read-modify-write of a user doc). */
export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const lock = `mx:${key}`;
  for (let i = 0; i < 100; i++) {
    if (await redis.set(lock, 1, { nx: true, px: 8000 })) {
      try { return await fn(); } finally { await redis.del(lock); }
    }
    await sleep(60);
  }
  return fn(); // lock holder died; proceed rather than drop the update
}
