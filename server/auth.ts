import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import type { CookieOptions } from 'express'
import type { ObjectId } from 'mongodb'
import type { UserDto } from '../shared/api'
import type { AppConfig } from './config'
import type { Collections, UserDoc } from './db'

export const SESSION_COOKIE = 'ps_session'

const SALT_BYTES = 16
const KEY_BYTES = 64
const HASH_PREFIX = 's1'
export const DUMMY_PASSWORD_HASH =
  's1$RLq0qACn78XnnZ81LkivIA$rSQOqkhGePS96weph4OILb5i0Tnaw72pdxn6g11YhY7edCZuh7KTB6fhYVpZJIuO2KzQxOcgNkkHsPcKrpdvJQ'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const EMAIL_MAX_LENGTH = 254
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 200

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const key = await deriveKey(password, salt)
  return `${HASH_PREFIX}$${salt.toString('base64url')}$${key.toString('base64url')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== HASH_PREFIX) return false
  const salt = Buffer.from(parts[1], 'base64url')
  const expected = Buffer.from(parts[2], 'base64url')
  if (salt.length !== SALT_BYTES || expected.length !== KEY_BYTES) return false
  const actual = await deriveKey(password, salt)
  return timingSafeEqual(actual, expected)
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return email.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(email)
}

export function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH
}

export function toUserDto(user: UserDoc): UserDto {
  return { id: user._id.toHexString(), email: user.email }
}

export function sessionTtlMs(config: Pick<AppConfig, 'sessionTtlDays'>): number {
  return config.sessionTtlDays * 24 * 60 * 60 * 1000
}

function baseCookieOptions(config: Pick<AppConfig, 'cookieSecure'>): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
  }
}

export function sessionCookieOptions(config: Pick<AppConfig, 'cookieSecure' | 'sessionTtlDays'>): CookieOptions {
  return { ...baseCookieOptions(config), maxAge: sessionTtlMs(config) }
}

export function clearSessionCookieOptions(config: Pick<AppConfig, 'cookieSecure'>): CookieOptions {
  return baseCookieOptions(config)
}

export function isSessionToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value)
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!header) return cookies

  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    const name = part.slice(0, separator).trim()
    const rawValue = part.slice(separator + 1).trim()
    if (!name || name in cookies) continue
    try {
      cookies[name] = decodeURIComponent(rawValue)
    } catch {
      cookies[name] = rawValue
    }
  }

  return cookies
}

export async function issueSession(collections: Collections, userId: ObjectId, ttlMs: number): Promise<string> {
  const token = createSessionToken()
  const createdAt = new Date()
  await collections.sessions.insertOne({
    _id: hashToken(token),
    userId,
    createdAt,
    expiresAt: new Date(createdAt.getTime() + ttlMs),
  })
  return token
}
