import type {
  AuthRequestDto,
  HealthDto,
  HistoryEntryDto,
  SaveRequestDto,
  SaveResultDto,
  UserDto,
} from '../../shared/api'
import { DEFAULT_SETTINGS, parseFieldDocs, parseSettings, type BriefSettings, type FieldDocs } from '../../shared/brief-docs'

export class ApiError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(status: number, message: string, code: string | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

const RETRY_DELAYS = [0, 1500, 4000, 8000] as const
const ATTEMPT_TIMEOUT = 65_000
const NETWORK_MESSAGE = 'Could not reach the server.'

export interface WakeRetryOptions {
  onRetry?: (attempt: number) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readUser(value: unknown): UserDto | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.email !== 'string') {
    return null
  }
  return { id: value.id, email: value.email }
}

function readEntry(value: unknown): HistoryEntryDto | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.savedAt !== 'number') return null

  const docs = parseFieldDocs(value.docs)
  if (!docs) return null

  return {
    id: value.id,
    savedAt: value.savedAt,
    docs,
    settings: parseSettings(value.settings) ?? DEFAULT_SETTINGS,
  }
}

function unexpectedResponse(): ApiError {
  return new ApiError(200, 'Unexpected response from the server.', 'invalid_response')
}

async function send(path: string, init: RequestInit, signal?: AbortSignal): Promise<unknown> {
  const headers = new Headers(init.headers)
  if (init.body !== undefined) headers.set('Content-Type', 'application/json')

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: 'include',
    signal,
  })

  const text = await response.text()
  let body: unknown = null
  if (text.length > 0) {
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
  }

  if (!response.ok) {
    const message =
      isRecord(body) && typeof body.error === 'string'
        ? body.error
        : `Request failed (${response.status}).`
    const code = isRecord(body) && typeof body.code === 'string' ? body.code : null
    throw new ApiError(response.status, message, code)
  }

  return body
}

function isRetryable(error: ApiError): boolean {
  return error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504
}

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError(0, NETWORK_MESSAGE, 'network')
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withWakeRetry<T>(
  attempt: (signal: AbortSignal) => Promise<T>,
  options: WakeRetryOptions = {},
): Promise<T> {
  let lastError = new ApiError(0, NETWORK_MESSAGE, 'network')

  for (let index = 0; index <= RETRY_DELAYS.length; index += 1) {
    if (index > 0) {
      options.onRetry?.(index + 1)
      await wait(RETRY_DELAYS[index - 1] ?? 0)
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT)
    try {
      return await attempt(controller.signal)
    } catch (error) {
      lastError = toApiError(error)
      if (!isRetryable(lastError)) throw lastError
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError
}

function retryJson(
  path: string,
  init: RequestInit,
  onRetry?: (attempt: number) => void,
): Promise<unknown> {
  return withWakeRetry((signal) => send(path, init, signal), { onRetry })
}

function requireUser(body: unknown): UserDto {
  const user = isRecord(body) ? readUser(body.user) : null
  if (!user) throw unexpectedResponse()
  return user
}

export async function me(signal?: AbortSignal): Promise<UserDto | null> {
  const body = await send('/api/auth/me', { method: 'GET' }, signal)
  if (!isRecord(body) || !('user' in body)) throw unexpectedResponse()
  if (body.user === null) return null

  const user = readUser(body.user)
  if (!user) throw unexpectedResponse()
  return user
}

export async function signup(input: AuthRequestDto): Promise<UserDto> {
  const body = await send('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return requireUser(body)
}

export async function login(input: AuthRequestDto): Promise<UserDto> {
  const body = await retryJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return requireUser(body)
}

export async function logout(): Promise<void> {
  await retryJson('/api/auth/logout', { method: 'POST' })
}

export async function health(signal?: AbortSignal): Promise<HealthDto> {
  const body = await send('/api/health', { method: 'GET' }, signal)
  if (!isRecord(body) || typeof body.ok !== 'boolean' || typeof body.uptime !== 'number') {
    throw unexpectedResponse()
  }

  const db = body.db
  if (db !== 'connected' && db !== 'connecting' && db !== 'error') throw unexpectedResponse()

  return { ok: body.ok, db, uptime: body.uptime }
}

export async function listHistory(): Promise<HistoryEntryDto[]> {
  const body = await retryJson('/api/history', { method: 'GET' })
  if (!isRecord(body) || !Array.isArray(body.entries)) throw unexpectedResponse()

  const entries: HistoryEntryDto[] = []
  for (const value of body.entries) {
    const entry = readEntry(value)
    if (entry) entries.push(entry)
  }
  return entries
}

export async function saveHistory(
  docs: FieldDocs,
  settings: BriefSettings,
  onRetry?: (attempt: number) => void,
): Promise<SaveResultDto> {
  const request: SaveRequestDto = { docs, settings }
  const body = await retryJson(
    '/api/history',
    { method: 'POST', body: JSON.stringify(request) },
    onRetry,
  )
  if (!isRecord(body) || typeof body.duplicate !== 'boolean') throw unexpectedResponse()

  const entry = readEntry(body.entry)
  if (!entry) throw unexpectedResponse()

  return { entry, duplicate: body.duplicate }
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  await retryJson(`/api/history/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function clearHistory(): Promise<void> {
  await retryJson('/api/history', { method: 'DELETE' })
}
