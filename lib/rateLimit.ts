import { NextRequest, NextResponse } from 'next/server'

/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Caveat: state lives in the Node.js process, so on Vercel's serverless
 * runtime each concurrent instance keeps its own counters -- this is a
 * best-effort abuse brake, not a hard guarantee. For strict limits under
 * real traffic, swap this for a shared store (e.g. Upstash Redis /
 * @upstash/ratelimit) without changing the call sites below.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// Periodically drop stale buckets so this map can't grow unbounded.
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key)
  }
}, 60_000).unref?.()

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

export interface RateLimitOptions {
  /** Logical bucket name, e.g. "auth:telegram" */
  key: string
  /** Max requests allowed within the window */
  limit: number
  /** Window size in milliseconds */
  windowMs: number
}

/**
 * Returns a 429 NextResponse if the caller is over the limit, otherwise null.
 * Usage: `const limited = rateLimit(req, { key: 'auth', limit: 10, windowMs: 60_000 }); if (limited) return limited`
 */
export function rateLimit(req: NextRequest, opts: RateLimitOptions): NextResponse | null {
  const bucketKey = `${opts.key}:${clientIp(req)}`
  const now = Date.now()
  const existing = buckets.get(bucketKey)

  if (!existing || existing.resetAt < now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + opts.windowMs })
    return null
  }

  if (existing.count >= opts.limit) {
    const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000)
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
    )
  }

  existing.count += 1
  return null
}
