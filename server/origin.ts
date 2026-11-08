import type { RequestHandler } from 'express'

export interface OriginConfig {
  isProduction: boolean
  appOrigin: string | null
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const DEV_ORIGIN_PATTERN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '').toLowerCase()
}

export function isAllowedOrigin(origin: string, config: OriginConfig): boolean {
  const normalized = normalizeOrigin(origin)
  if (config.appOrigin && normalizeOrigin(config.appOrigin) === normalized) return true
  if (!config.isProduction && DEV_ORIGIN_PATTERN.test(normalized)) return true
  return false
}

export function createOriginGuard(config: OriginConfig): RequestHandler {
  return (req, res, next) => {
    if (!UNSAFE_METHODS.has(req.method)) {
      next()
      return
    }

    const origin = req.headers.origin
    if (origin) {
      if (isAllowedOrigin(origin, config)) {
        next()
        return
      }
      res.status(403).json({ error: 'Origin not allowed', code: 'forbidden_origin' })
      return
    }

    if (req.headers['sec-fetch-site'] === 'same-origin') {
      next()
      return
    }

    res.status(403).json({ error: 'Origin required', code: 'forbidden_origin' })
  }
}
