// Best-effort in-memory fixed-window rate limiter.
//
// NOTE: counters live in the server process's memory. In a multi-instance or
// serverless deployment each instance keeps its own buckets, so this is a
// best-effort throttle rather than a global guarantee. For production-grade
// limiting back this with a shared store (e.g. Upstash Redis / @upstash/ratelimit).

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
  return { ok: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

/** Pull a best-effort client identifier from proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Standard 429 response with a Retry-After header. */
export function tooManyRequests(retryAfterSeconds: number) {
  return Response.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, retryAfterSeconds)) },
    }
  );
}
