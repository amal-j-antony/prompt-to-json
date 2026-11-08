import 'dotenv/config'
import path from 'node:path'

export interface AppConfig {
  port: number
  mongoUri: string
  mongoDbName: string
  sessionTtlDays: number
  appOrigin: string | null
  isProduction: boolean
  cookieSecure: boolean
  distDir: string
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function readOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.replace(/\/+$/, '')
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const isProduction = env.NODE_ENV === 'production'
  const configuredOrigin = readOrigin(env.APP_ORIGIN)
  const renderOrigin = isProduction ? readOrigin(env.RENDER_EXTERNAL_URL) : null
  const publicOrigin = configuredOrigin ?? renderOrigin
  const cookieSecure =
    env.COOKIE_SECURE === 'true'
      ? true
      : env.COOKIE_SECURE === 'false'
        ? false
        : isProduction || Boolean(publicOrigin?.startsWith('https://'))

  return {
    port: readPositiveInt(env.PORT, 8787),
    mongoUri: env.MONGODB_URI?.trim() ?? '',
    mongoDbName: env.MONGODB_DB?.trim() || 'prompt_studio',
    sessionTtlDays: readPositiveInt(env.SESSION_TTL_DAYS, 30),
    appOrigin: publicOrigin,
    isProduction,
    cookieSecure,
    distDir: path.resolve(process.cwd(), 'dist'),
  }
}

export const config = loadConfig()
