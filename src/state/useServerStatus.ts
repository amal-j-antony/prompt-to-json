import { useCallback, useEffect, useRef, useState } from 'react'
import { health } from '../lib/api'

export type ServerStatus = 'checking' | 'online' | 'degraded' | 'waking' | 'offline'

const ONLINE_POLL = 30_000
const RETRY_POLL = 10_000
const HEALTH_TIMEOUT = 8_000

export interface ServerStatusController {
  status: ServerStatus
  check(): void
  reportWake(): void
}

export function useServerStatus(): ServerStatusController {
  const [status, setStatus] = useState<ServerStatus>('checking')
  const statusRef = useRef<ServerStatus>('checking')
  const failuresRef = useRef(0)
  const inFlightRef = useRef(false)
  const mountedRef = useRef(true)

  const apply = useCallback((next: ServerStatus) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  const run = useCallback(async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    if (statusRef.current === 'offline' || statusRef.current === 'waking') apply('waking')

    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), HEALTH_TIMEOUT)
    try {
      const result = await health(controller.signal)
      if (!mountedRef.current) return
      failuresRef.current = 0
      apply(result.db === 'connected' ? 'online' : 'degraded')
    } catch {
      if (!mountedRef.current) return
      failuresRef.current += 1
      apply(failuresRef.current >= 2 ? 'offline' : 'waking')
    } finally {
      window.clearTimeout(timer)
      inFlightRef.current = false
    }
  }, [apply])

  const check = useCallback(() => {
    apply('checking')
    void run()
  }, [apply, run])

  const reportWake = useCallback(() => {
    failuresRef.current = Math.max(1, failuresRef.current)
    apply('waking')
    void run()
  }, [apply, run])

  useEffect(() => {
    mountedRef.current = true
    void run()

    let timer = 0
    let stopped = false

    const schedule = () => {
      window.clearTimeout(timer)
      const delay = statusRef.current === 'online' ? ONLINE_POLL : RETRY_POLL
      timer = window.setTimeout(() => {
        const tick = async () => {
          if (!document.hidden) await run()
          if (!stopped) schedule()
        }
        void tick()
      }, delay)
    }

    const handleVisibility = () => {
      if (document.hidden) return
      window.clearTimeout(timer)
      void run().finally(() => {
        if (!stopped) schedule()
      })
    }

    schedule()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      stopped = true
      mountedRef.current = false
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [run])

  return { status, check, reportWake }
}
