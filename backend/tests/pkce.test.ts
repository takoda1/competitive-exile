import { describe, it, expect } from 'vitest'
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../lib/pkce.js'

const BASE64URL_RE = /^[A-Za-z0-9_-]+$/

describe('generateCodeVerifier', () => {
  it('produces a 43-character string (32 bytes base64url)', () => {
    expect(generateCodeVerifier()).toHaveLength(43)
  })

  it('contains only base64url-safe characters (no = padding)', () => {
    expect(generateCodeVerifier()).toMatch(BASE64URL_RE)
  })

  it('returns a unique value on each call', () => {
    expect(generateCodeVerifier()).not.toBe(generateCodeVerifier())
  })
})

describe('generateCodeChallenge', () => {
  it('produces a 43-character string (SHA-256 = 32 bytes base64url)', async () => {
    const verifier = generateCodeVerifier()
    const challenge = await generateCodeChallenge(verifier)
    expect(challenge).toHaveLength(43)
  })

  it('contains only base64url-safe characters', async () => {
    const challenge = await generateCodeChallenge(generateCodeVerifier())
    expect(challenge).toMatch(BASE64URL_RE)
  })

  it('is deterministic — same verifier produces same challenge', async () => {
    const verifier = generateCodeVerifier()
    const a = await generateCodeChallenge(verifier)
    const b = await generateCodeChallenge(verifier)
    expect(a).toBe(b)
  })

  it('produces the correct SHA-256 for a known input', async () => {
    const knownVerifier = 'dGVzdHZlcmlmaWVyMTIzNDU2Nzg5MA'
    const expected = 'FXVlzTZTJSwJnPDawzGpqo8dpdLXEfVMTCWZtcgGyzQ'
    expect(await generateCodeChallenge(knownVerifier)).toBe(expected)
  })
})

describe('generateState', () => {
  it('returns a non-empty string', () => {
    expect(generateState().length).toBeGreaterThan(0)
  })

  it('returns unique values across calls', () => {
    expect(generateState()).not.toBe(generateState())
  })
})
