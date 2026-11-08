import { describe, expect, it } from 'vitest'
import { RateLimiter } from './rateLimit'

describe('RateLimiter', () => {
  it('allows up to the limit then blocks until the window resets', () => {
    let now = 1_000
    const limiter = new RateLimiter(3, 60_000, () => now)

    expect(limiter.take('ip').allowed).toBe(true)
    expect(limiter.take('ip').allowed).toBe(true)
    expect(limiter.take('ip').allowed).toBe(true)

    const blocked = limiter.take('ip')
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterMs).toBe(60_000)

    now += 59_999
    expect(limiter.take('ip').allowed).toBe(false)

    now += 1
    expect(limiter.take('ip').allowed).toBe(true)
  })

  it('tracks keys independently', () => {
    const limiter = new RateLimiter(1, 60_000, () => 0)
    expect(limiter.take('first').allowed).toBe(true)
    expect(limiter.take('first').allowed).toBe(false)
    expect(limiter.take('second').allowed).toBe(true)
  })

  it('reports the remaining window', () => {
    let now = 0
    const limiter = new RateLimiter(1, 10_000, () => now)
    expect(limiter.take('ip').allowed).toBe(true)
    now = 4_000
    expect(limiter.take('ip')).toEqual({ allowed: false, retryAfterMs: 6_000 })
  })
})
