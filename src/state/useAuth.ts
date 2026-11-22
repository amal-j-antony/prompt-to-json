import { useCallback, useEffect, useState } from 'react'
import type { UserDto } from '../../shared/api'
import {
  ApiError,
  login as loginRequest,
  logout as logoutRequest,
  me,
  signup as signupRequest,
  withWakeRetry,
} from '../lib/api'
import { IS_DESKTOP } from '../lib/platform'

export type AuthStatus = 'loading' | 'ready'

export interface AuthController {
  status: AuthStatus
  user: UserDto | null
  busy: boolean
  error: string | null
  signup(email: string, password: string): Promise<boolean>
  login(email: string, password: string): Promise<boolean>
  logout(): Promise<boolean>
  clearError(): void
}

function messageFor(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Could not reach the server. Try again.'

  switch (error.code) {
    case 'email_taken':
      return 'That email is already registered.'
    case 'invalid_credentials':
      return 'Email or password is incorrect.'
    case 'rate_limited':
      return 'Too many attempts. Wait a few minutes and try again.'
    case 'db_unavailable':
      return 'The server is not ready. Try again shortly.'
    case 'invalid_input':
      return 'Check the email and password and try again.'
    default:
      return error.status === 0 ? 'Could not reach the server. Try again.' : error.message
  }
}

export function useAuth(): AuthController {
  const [status, setStatus] = useState<AuthStatus>(IS_DESKTOP ? 'ready' : 'loading')
  const [user, setUser] = useState<UserDto | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (IS_DESKTOP) return

    let cancelled = false

    void withWakeRetry((signal) => me(signal))
      .then((result) => {
        if (!cancelled) setUser(result)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setStatus('ready')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const signup = useCallback(async (email: string, password: string) => {
    if (IS_DESKTOP) return false
    setBusy(true)
    setError(null)
    try {
      const result = await signupRequest({ email: email.trim(), password })
      setUser(result)
      return true
    } catch (cause) {
      setError(messageFor(cause))
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    if (IS_DESKTOP) return false
    setBusy(true)
    setError(null)
    try {
      const result = await loginRequest({ email: email.trim(), password })
      setUser(result)
      return true
    } catch (cause) {
      setError(messageFor(cause))
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const logout = useCallback(async () => {
    if (IS_DESKTOP) return false
    setBusy(true)
    setError(null)
    try {
      await logoutRequest()
      setUser(null)
      return true
    } catch (cause) {
      setError(messageFor(cause))
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { status, user, busy, error, signup, login, logout, clearError }
}
