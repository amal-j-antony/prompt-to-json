import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, type BriefSettings, type FieldDocs } from '../../shared/brief-docs'
import { ApiError, listHistory, saveHistory, withWakeRetry } from './api'

function docs(goalText: string): FieldDocs {
  return {
    goal: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: goalText }] }],
    },
    done: { type: 'doc', content: [{ type: 'paragraph' }] },
    details: { type: 'doc', content: [{ type: 'paragraph' }] },
    nonGoals: { type: 'doc', content: [{ type: 'paragraph' }] },
    constraints: { type: 'doc', content: [{ type: 'paragraph' }] },
    files: { type: 'doc', content: [{ type: 'paragraph' }] },
    verify: { type: 'doc', content: [{ type: 'paragraph' }] },
    questions: { type: 'doc', content: [{ type: 'paragraph' }] },
  }
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
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

describe('saveHistory', () => {
  it('sends docs and settings in the request body', async () => {
    const settings: BriefSettings = { kind: 'bug', directives: ['plan'] }
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        jsonResponse({
          entry: { id: 'one', savedAt: 1, docs: docs('Ship it'), settings },
          duplicate: false,
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await saveHistory(docs('Ship it'), settings)

    const init = fetchMock.mock.calls[0]?.[1]
    expect(JSON.parse(String(init?.body))).toEqual({ docs: docs('Ship it'), settings })
    expect(result.duplicate).toBe(false)
    expect(result.entry.settings).toEqual(settings)
  })
})

describe('listHistory', () => {
  it('defaults settings when the server omits them', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ entries: [{ id: 'one', savedAt: 1, docs: docs('Ship it') }] })),
    )

    const entries = await listHistory()
    expect(entries).toHaveLength(1)
    expect(entries[0]?.settings).toEqual(DEFAULT_SETTINGS)
  })
})
