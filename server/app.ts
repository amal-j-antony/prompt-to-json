import { existsSync } from 'node:fs'
import path from 'node:path'
import express, { type Express, type NextFunction, type Request, type RequestHandler, type Response } from 'express'
import { MongoServerError, ObjectId } from 'mongodb'
import { parseFieldDocs } from '../shared/brief-docs'
import type { FieldDocs } from '../shared/brief-docs'
import type { HealthDto, MeDto, UserDto } from '../shared/api'
import { clearSessionCookieOptions, DUMMY_PASSWORD_HASH, hashPassword, hashToken, isSessionToken, isValidEmail, isValidPassword, issueSession, normalizeEmail, parseCookies, SESSION_COOKIE, sessionCookieOptions, sessionTtlMs, toUserDto, verifyPassword } from './auth'
import type { AppConfig } from './config'
import { isMongoUnavailable, type Collections, type Database, type UserDoc } from './db'
import { clearBriefs, deleteBrief, listBriefs, saveBrief } from './history'
import { createOriginGuard } from './origin'
import { createRateLimit, RateLimiter } from './rateLimit'
import { getRequestUser } from './types'

const MAX_DOCS_BYTES = 64 * 1024
const AUTH_RATE_LIMIT = 20
const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000
const AUTH_READ_RATE_LIMIT = 120
const LOGIN_EMAIL_RATE_LIMIT = 50
const LOGIN_EMAIL_WINDOW_MS = 60 * 60 * 1000

export interface AppDependencies {
  config: AppConfig
  db: Database
}

interface AuthInput {
  email: string
  password: string
}

type AsyncRoute = (req: Request, res: Response) => Promise<void>
type DbRoute = (req: Request, res: Response, collections: Collections) => Promise<void>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/')
}

function readAuthInput(body: unknown): AuthInput | null {
  if (!isRecord(body)) return null
  const rawEmail = body.email
  const rawPassword = body.password
  if (typeof rawEmail !== 'string' || typeof rawPassword !== 'string') return null
  const email = normalizeEmail(rawEmail)
  if (!isValidEmail(email) || !isValidPassword(rawPassword)) return null
  return { email, password: rawPassword }
}

function readDocs(body: unknown): FieldDocs | null {
  if (!isRecord(body)) return null
  const docs = parseFieldDocs(body.docs)
  if (!docs) return null
  if (JSON.stringify(docs).length > MAX_DOCS_BYTES) return null
  return docs
}

function sendDbUnavailable(res: Response): void {
  res.status(503).json({ error: 'Database unavailable', code: 'db_unavailable' })
}

function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000
}

function wrap(handler: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next)
  }
}

function withDb(db: Database, handler: DbRoute): RequestHandler {
  return (req, res, next) => {
    const collections = db.collections()
    if (!collections) {
      sendDbUnavailable(res)
      return
    }
    handler(req, res, collections).catch(next)
  }
}

async function resolveSessionUser(req: Request, collections: Collections): Promise<UserDoc | null> {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
  if (!token || !isSessionToken(token)) return null

  const session = await collections.sessions.findOne({ _id: hashToken(token) })
  if (!session) return null

  if (session.expiresAt.getTime() <= Date.now()) {
    await collections.sessions.deleteOne({ _id: session._id })
    return null
  }

  const user = await collections.users.findOne({ _id: session.userId })
  if (!user) {
    await collections.sessions.deleteOne({ _id: session._id })
    return null
  }

  return user
}

function requireUser(db: Database): RequestHandler {
  return (req, res, next) => {
    const collections = db.collections()
    if (!collections) {
      sendDbUnavailable(res)
      return
    }

    resolveSessionUser(req, collections)
      .then((user) => {
        if (!user) {
          res.status(401).json({ error: 'Authentication required', code: 'auth_required' })
          return
        }
        req.user = user
        next()
      })
      .catch(next)
  }
}

const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('X-Frame-Options', 'DENY')
  next()
}

interface ErrorShape {
  type?: unknown
}

function readErrorShape(error: unknown): ErrorShape {
  if (typeof error === 'object' && error !== null && 'type' in error) return { type: error.type }
  return {}
}

export function createApp(deps: AppDependencies): Express {
  const { config, db } = deps
  const app = express()
  const authLimiter = new RateLimiter(AUTH_RATE_LIMIT, AUTH_RATE_WINDOW_MS)
  const authReadLimiter = new RateLimiter(AUTH_READ_RATE_LIMIT, AUTH_RATE_WINDOW_MS)
  const loginEmailLimiter = new RateLimiter(LOGIN_EMAIL_RATE_LIMIT, LOGIN_EMAIL_WINDOW_MS)
  const limitAuth = createRateLimit(authLimiter)
  const limitAuthRead = createRateLimit(authReadLimiter)

  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(securityHeaders)
  app.use(createOriginGuard(config))
  app.use(express.json({ limit: '256kb' }))

  app.get('/api/ping', (_req, res) => {
    res.json({ ok: true })
  })

  app.get('/api/health', (_req, res) => {
    const status = db.status
    const health: HealthDto = { ok: status === 'connected', db: status, uptime: process.uptime() }
    res.json(health)
  })

  app.post(
    '/api/auth/signup',
    limitAuth,
    withDb(db, async (req, res, collections) => {
      const input = readAuthInput(req.body)
      if (!input) {
        res.status(400).json({ error: 'Invalid email or password', code: 'invalid_input' })
        return
      }

      const user: UserDoc = {
        _id: new ObjectId(),
        email: input.email,
        passwordHash: await hashPassword(input.password),
        createdAt: new Date(),
      }

      try {
        await collections.users.insertOne(user)
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          res.status(409).json({ error: 'Email already registered', code: 'email_taken' })
          return
        }
        throw error
      }

      const token = await issueSession(collections, user._id, sessionTtlMs(config))
      res.cookie(SESSION_COOKIE, token, sessionCookieOptions(config))
      const dto: UserDto = toUserDto(user)
      res.status(201).json({ user: dto })
    }),
  )

  app.post(
    '/api/auth/login',
    limitAuth,
    withDb(db, async (req, res, collections) => {
      const input = readAuthInput(req.body)
      if (!input) {
        res.status(400).json({ error: 'Invalid email or password', code: 'invalid_input' })
        return
      }

      const emailLimit = loginEmailLimiter.take(input.email)
      if (!emailLimit.allowed) {
        res.setHeader('Retry-After', String(Math.ceil(emailLimit.retryAfterMs / 1000)))
        res.status(429).json({ error: 'Too many requests', code: 'rate_limited' })
        return
      }

      const user = await collections.users.findOne({ email: input.email })
      const passwordMatches = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH)
      if (!user || !passwordMatches) {
        res.status(401).json({ error: 'Invalid credentials', code: 'invalid_credentials' })
        return
      }

      const token = await issueSession(collections, user._id, sessionTtlMs(config))
      res.cookie(SESSION_COOKIE, token, sessionCookieOptions(config))
      const dto: UserDto = toUserDto(user)
      res.json({ user: dto })
    }),
  )

  app.post(
    '/api/auth/logout',
    limitAuthRead,
    withDb(db, async (req, res, collections) => {
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
      if (token && isSessionToken(token)) await collections.sessions.deleteOne({ _id: hashToken(token) })
      res.clearCookie(SESSION_COOKIE, clearSessionCookieOptions(config))
      res.status(204).end()
    }),
  )

  app.get(
    '/api/auth/me',
    limitAuthRead,
    wrap(async (req, res) => {
      const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
      if (!token) {
        res.json({ user: null } satisfies MeDto)
        return
      }

      const collections = db.collections()
      if (!collections) {
        sendDbUnavailable(res)
        return
      }

      const user = await resolveSessionUser(req, collections)
      res.json({ user: user ? toUserDto(user) : null } satisfies MeDto)
    }),
  )

  app.get(
    '/api/history',
    requireUser(db),
    withDb(db, async (req, res, collections) => {
      const user = getRequestUser(req)
      const entries = await listBriefs(collections, user._id)
      res.json({ entries })
    }),
  )

  app.post(
    '/api/history',
    requireUser(db),
    withDb(db, async (req, res, collections) => {
      const docs = readDocs(req.body)
      if (!docs) {
        res.status(400).json({ error: 'Invalid docs', code: 'invalid_docs' })
        return
      }
      const user = getRequestUser(req)
      const result = await saveBrief(collections, user._id, docs)
      res.json(result)
    }),
  )

  app.delete(
    '/api/history/:id',
    requireUser(db),
    withDb(db, async (req, res, collections) => {
      const user = getRequestUser(req)
      const id = req.params.id
      const deleted = typeof id === 'string' ? await deleteBrief(collections, user._id, id) : false
      if (!deleted) {
        res.status(404).json({ error: 'Not found', code: 'not_found' })
        return
      }
      res.status(204).end()
    }),
  )

  app.delete(
    '/api/history',
    requireUser(db),
    withDb(db, async (req, res, collections) => {
      const user = getRequestUser(req)
      await clearBriefs(collections, user._id)
      res.status(204).end()
    }),
  )

  const indexFile = path.join(config.distDir, 'index.html')
  if (existsSync(indexFile)) {
    app.use(express.static(config.distDir))
    app.use((req, res, next) => {
      if (req.method !== 'GET' || isApiPath(req.path)) {
        next()
        return
      }
      res.sendFile(indexFile)
    })
  }

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found', code: 'not_found' })
  })

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found', code: 'not_found' })
  })

  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error)
      return
    }

    const shape = readErrorShape(error)
    if (shape.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Invalid JSON body', code: 'invalid_input' })
      return
    }
    if (shape.type === 'entity.too.large') {
      res.status(413).json({ error: 'Payload too large', code: 'payload_too_large' })
      return
    }
    if (isMongoUnavailable(error)) {
      db.markUnavailable()
      sendDbUnavailable(res)
      return
    }

    console.error('request failed', req.method, req.path, error instanceof Error ? error.name : 'unknown error')
    res.status(500).json({ error: 'Internal server error', code: 'internal_error' })
  })

  return app
}
