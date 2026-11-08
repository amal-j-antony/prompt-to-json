import { describe, expect, it } from 'vitest'
import { isAllowedOrigin } from './origin'
import type { OriginConfig } from './origin'

const production: OriginConfig = { isProduction: true, appOrigin: 'https://prompt.example.com' }
const development: OriginConfig = { isProduction: false, appOrigin: null }

describe('isAllowedOrigin', () => {
  it('allows the configured origin in production', () => {
    expect(isAllowedOrigin('https://prompt.example.com', production)).toBe(true)
    expect(isAllowedOrigin('https://prompt.example.com/', production)).toBe(true)
  })

  it('rejects another origin in production', () => {
    expect(isAllowedOrigin('https://evil.example.com', production)).toBe(false)
    expect(isAllowedOrigin('http://localhost:5173', production)).toBe(false)
  })

  it('rejects everything when production has no configured origin', () => {
    expect(isAllowedOrigin('https://prompt.example.com', { isProduction: true, appOrigin: null })).toBe(false)
  })

  it('allows local dev origins in development', () => {
    expect(isAllowedOrigin('http://localhost:5173', development)).toBe(true)
    expect(isAllowedOrigin('http://localhost:8787', development)).toBe(true)
    expect(isAllowedOrigin('http://127.0.0.1:5173', development)).toBe(true)
  })

  it('rejects lookalike and remote origins in development', () => {
    expect(isAllowedOrigin('http://localhost.evil.com', development)).toBe(false)
    expect(isAllowedOrigin('https://localhost:5173', development)).toBe(false)
    expect(isAllowedOrigin('http://evil.example.com', development)).toBe(false)
  })

  it('allows the configured origin in development too', () => {
    expect(isAllowedOrigin('http://localhost:5173', { isProduction: false, appOrigin: 'http://localhost:5173' })).toBe(true)
  })
})
