import type { Request } from 'express'
import type { UserDoc } from './db'

declare global {
  namespace Express {
    interface Request {
      user?: UserDoc
    }
  }
}

export function getRequestUser(req: Request): UserDoc {
  if (!req.user) throw new Error('getRequestUser called without requireUser')
  return req.user
}
