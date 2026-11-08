import type { RequestHandler } from 'express'

export interface RateLimitResult {
  allowed: boolean
  retryAfterMs: number
}

interface Bucket {
  count: number
  resetAt: number
}

export class RateLimiter {
  private readonly limit: number
  private readonly windowMs: number
  private readonly now: () => number
  private readonly maxKeys: number
  private readonly buckets = new Map<string, Bucket>()

  constructor(limit: number, windowMs: number, now: () => number = Date.now, maxKeys = 20_000) {
    this.limit = limit
    this.windowMs = windowMs
    this.now = now
    this.maxKeys = maxKeys
  }

  take(key: string): RateLimitResult {
    const current = this.now()
    const bucket = this.buckets.get(key)

    if (!bucket || current >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: current + this.windowMs })
      this.prune(current)
      this.trim()
      return { allowed: true, retryAfterMs: 0 }
    }

    if (bucket.count >= this.limit) {
      return { allowed: false, retryAfterMs: bucket.resetAt - current }
    }

    bucket.count += 1
    return { allowed: true, retryAfterMs: 0 }
  }

  private prune(now: number): void {
    if (this.buckets.size < this.maxKeys / 2) return
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) this.buckets.delete(key)
    }
  }

  private trim(): void {
    while (this.buckets.size > this.maxKeys) {
      const oldest = this.buckets.keys().next().value
      if (oldest === undefined) return
      this.buckets.delete(oldest)
    }
  }
}

export function createRateLimit(limiter: RateLimiter): RequestHandler {
  return (req, res, next) => {
    const result = limiter.take(req.ip ?? 'unknown')
    if (!result.allowed) {
      res.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)))
      res.status(429).json({ error: 'Too many requests', code: 'rate_limited' })
      return
    }
    next()
  }
}
