import { describe, it, expect, beforeAll, vi } from 'vitest'

// crypto.ts is server-only and reads the master key from the env at call time.
vi.mock('server-only', () => ({}))

// A deterministic 32-byte key (64 hex) for the suite — never a real one.
beforeAll(() => {
  process.env.WEBHOOK_SECRET_KEY = '0'.repeat(64)
})

import {
  encryptSecret,
  decryptSecret,
  generateSigningSecret,
  signPayload,
  verifySignature,
} from '@/lib/webhooks/crypto'

describe('webhook crypto', () => {
  it('generates a recognisable, unique signing secret', () => {
    const a = generateSigningSecret()
    const b = generateSigningSecret()
    expect(a).toMatch(/^whsec_[0-9a-f]{48}$/)
    expect(a).not.toBe(b)
  })

  it('round-trips a secret through encryption', () => {
    const secret = generateSigningSecret()
    const stored = encryptSecret(secret)
    expect(stored).not.toContain(secret) // never stored in the clear
    expect(stored.startsWith('v1:')).toBe(true)
    expect(decryptSecret(stored)).toBe(secret)
  })

  it('produces a different ciphertext each time (random IV)', () => {
    const secret = 'whsec_fixed'
    expect(encryptSecret(secret)).not.toBe(encryptSecret(secret))
  })

  it('rejects tampered ciphertext (GCM auth tag)', () => {
    const stored = encryptSecret('whsec_tamper')
    const parts = stored.split(':')
    // Flip a byte in the ciphertext segment.
    const data = Buffer.from(parts[3]!, 'base64')
    data[0] = data[0]! ^ 0xff
    parts[3] = data.toString('base64')
    expect(() => decryptSecret(parts.join(':'))).toThrow()
  })

  it('rejects an unrecognised ciphertext format', () => {
    expect(() => decryptSecret('v2:a:b:c')).toThrow(/format/i)
    expect(() => decryptSecret('not-a-ciphertext')).toThrow()
  })

  it('signs deterministically as sha256=<hex>', () => {
    const sig = signPayload('{"hello":"world"}', 'whsec_test')
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/)
    // Same input, same signature.
    expect(signPayload('{"hello":"world"}', 'whsec_test')).toBe(sig)
  })

  it('verifies a genuine signature and rejects a forged one', () => {
    const body = JSON.stringify({ id: '1', type: 'ping' })
    const secret = 'whsec_verify'
    const sig = signPayload(body, secret)
    expect(verifySignature(body, secret, sig)).toBe(true)
    // Wrong secret, altered body, and a garbage signature all fail.
    expect(verifySignature(body, 'whsec_other', sig)).toBe(false)
    expect(verifySignature(body + ' ', secret, sig)).toBe(false)
    expect(verifySignature(body, secret, 'sha256=deadbeef')).toBe(false)
  })
})
