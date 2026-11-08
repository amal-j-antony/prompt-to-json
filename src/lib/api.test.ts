import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, withWakeRetry } from './api'

afterEach(() => {
  vi.useRealTimers()
})

describe('withWakeRetry', () => {
  it('retries 503 responses on the 0, 1500, 4000, 8000 schedule', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)

    const times: number[] = []
    const retries: number[] = []
    const attempt = vi.fn(async () => {
      times.push(Date.now())
      if (times.length < 5) throw new ApiError(503, 'down', 'db_unavailable')
      return 'ok'
    })

    const pending = withWakeRetry(attempt, { onRetry: (number) => retries.push(number) })
    await vi.runAllTimersAsync()

    await expect(pending).resolves.toBe('ok')
    expect(times).toEqual([0, 0, 1500, 5500, 13500])
    expect(retries).toEqual([2, 3, 4, 5])
    expect(attempt).toHaveBeenCalledTimes(5)
  })

  it('does not retry a 400', async () => {
    const attempt = vi.fn(async () => {
      throw new ApiError(400, 'bad', 'invalid_docs')
    })

    await expect(withWakeRetry(attempt)).rejects.toMatchObject({ status: 400 })
    expect(attempt).toHaveBeenCalledTimes(1)
  })

  it('aborts each attempt after 65 seconds', async () => {
    vi.useFakeTimers()

    const signals: AbortSignal[] = []
    const attempt = vi.fn((signal: AbortSignal) => {
      signals.push(signal)
      return new Promise<string>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')))
      })
    })

    const pending = withWakeRetry(attempt)
    const settled = pending.catch((error: unknown) => error)

    await vi.advanceTimersByTimeAsync(0)
    expect(signals[0]?.aborted).toBe(false)

    await vi.advanceTimersByTimeAsync(65_000)
    expect(signals[0]?.aborted).toBe(true)

    await vi.runAllTimersAsync()
    const error = await settled

    expect(error).toBeInstanceOf(ApiError)
    expect(attempt).toHaveBeenCalledTimes(5)
  })
})
