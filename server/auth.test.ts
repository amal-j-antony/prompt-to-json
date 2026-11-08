import { describe, expect, it } from 'vitest'
import {
  createSessionToken,
  hashPassword,
  hashToken,
  isSessionToken,
  isValidEmail,
  normalizeEmail,
  parseCookies,
  sessionCookieOptions,
  verifyPassword,
} from './auth'

describe('password hashing', () => {
  it('round trips a password', async () => {
    const stored = await hashPassword('correct horse battery')
    expect(stored.startsWith('s1$')).toBe(true)
    expect(await verifyPassword('correct horse battery', stored)).toBe(true)
  })

  it('salts each hash', async () => {
    const first = await hashPassword('same password')
    const second = await hashPassword('same password')
    expect(first).not.toBe(second)
  })

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('correct horse battery')
    expect(await verifyPassword('wrong horse battery', stored)).toBe(false)
  })

  it('rejects malformed hashes', async () => {
    expect(await verifyPassword('whatever', '')).toBe(false)
    expect(await verifyPassword('whatever', 'not-a-hash')).toBe(false)
    expect(await verifyPassword('whatever', 's2$c2FsdA$aGFzaA')).toBe(false)
    expect(await verifyPassword('whatever', 's1$c2FsdA$aGFzaA')).toBe(false)
  })
})

describe('session tokens', () => {
  it('hashes deterministically', () => {
    expect(hashToken('token')).toBe(hashToken('token'))
  })

  it('hashes distinct tokens differently', () => {
    const first = createSessionToken()
    const second = createSessionToken()
    expect(first).not.toBe(second)
    expect(hashToken(first)).not.toBe(hashToken(second))
  })

  it('produces url safe tokens', () => {
    const token = createSessionToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(token.length).toBe(43)
    expect(isSessionToken(token)).toBe(true)
  })

  it('rejects tokens with the wrong shape before a database lookup', () => {
    expect(isSessionToken('short')).toBe(false)
    expect(isSessionToken('x'.repeat(42))).toBe(false)
    expect(isSessionToken('x'.repeat(44))).toBe(false)
    expect(isSessionToken('x'.repeat(42) + '!')).toBe(false)
  })
})

describe('account input', () => {
  it('normalizes email', () => {
    expect(normalizeEmail('  Person@Example.COM ')).toBe('person@example.com')
  })

  it('validates email shape', () => {
    expect(isValidEmail('person@example.com')).toBe(true)
    expect(isValidEmail('person@example')).toBe(false)
    expect(isValidEmail('person example.com')).toBe(false)
  })
})

describe('cookies', () => {
  it('parses cookie headers', () => {
    expect(parseCookies('ps_session=abc; theme=dark')).toEqual({ ps_session: 'abc', theme: 'dark' })
    expect(parseCookies(undefined)).toEqual({})
  })

  it('marks the session cookie secure when configured', () => {
    const options = sessionCookieOptions({ cookieSecure: true, sessionTtlDays: 30 })
    expect(options.httpOnly).toBe(true)
    expect(options.sameSite).toBe('lax')
    expect(options.secure).toBe(true)
    expect(options.path).toBe('/')
    expect(options.maxAge).toBe(30 * 24 * 60 * 60 * 1000)
  })
})
