import 'server-only'
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import { serverEnv } from '@/lib/env'

/**
 * Webhook cryptography (playbook S116).
 *
 * Two distinct secrets, easy to conflate and dangerous to:
 *
 *   • The MASTER key (`WEBHOOK_SECRET_KEY`) is ours. It encrypts each endpoint's
 *     signing secret at rest so a database leak does not hand an attacker the
 *     ability to forge signed events. It never leaves the server.
 *
 *   • The SIGNING secret is the endpoint's. It is generated per webhook, shown to
 *     the owner exactly once at creation, and used to HMAC every payload. The
 *     owner configures the same secret in n8n to verify deliveries are genuinely
 *     from us. We store only its ciphertext — after creation we can sign with it
 *     but can never show it again, only rotate it.
 *
 * This split is the reason a signing secret is "shown once": a value we can
 * retrieve is a value everyone with historical DB read access also has.
 */

const SIGNING_SECRET_PREFIX = 'whsec_'
const ENCRYPTION_VERSION = 'v1'

/** The master key as raw bytes, validated to AES-256's 32-byte length. */
function masterKey(): Buffer {
  const hex = serverEnv.webhookSecretKey
  const key = Buffer.from(hex, 'hex')
  if (key.length !== 32) {
    throw new Error(
      'WEBHOOK_SECRET_KEY must be 64 hex characters (32 bytes). Generate with `openssl rand -hex 32`.'
    )
  }
  return key
}

/**
 * A fresh signing secret for a new endpoint. Prefixed so a leaked value is
 * recognisable in logs and the owner can tell it apart from other credentials.
 */
export function generateSigningSecret(): string {
  return SIGNING_SECRET_PREFIX + randomBytes(24).toString('hex')
}

/**
 * Encrypt a signing secret for storage. Output is
 * `v1:<iv>:<authTag>:<ciphertext>`, all base64 — the version prefix lets us
 * rotate the scheme later without guessing at old rows' format.
 */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12) // 96-bit nonce, the GCM standard
  const cipher = createCipheriv('aes-256-gcm', masterKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [
    ENCRYPTION_VERSION,
    iv.toString('base64'),
    authTag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':')
}

/**
 * Decrypt a stored signing secret. Throws on any tampering (GCM auth tag) or on
 * an unrecognised version — a corrupted row must fail loudly, never silently
 * produce a wrong secret that signs deliveries no consumer can verify.
 */
export function decryptSecret(stored: string): string {
  const parts = stored.split(':')
  if (parts.length !== 4 || parts[0] !== ENCRYPTION_VERSION) {
    throw new Error('Unrecognised webhook secret ciphertext format.')
  }
  const [, ivB64, tagB64, dataB64] = parts
  const decipher = createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(ivB64!, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64!, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64!, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}

/**
 * The signature for a delivery body. HMAC-SHA256 over the exact bytes we send, so
 * the consumer signs the raw request body — not a re-serialised copy that may
 * differ by key order or whitespace — and compares. Returned as `sha256=<hex>`,
 * the widely-recognised scheme (Stripe, GitHub), which keeps the n8n-side
 * verification snippet familiar.
 */
export function signPayload(rawBody: string, signingSecret: string): string {
  const mac = createHmac('sha256', signingSecret).update(rawBody, 'utf8').digest('hex')
  return `sha256=${mac}`
}

/**
 * Constant-time signature check — for our own tests and any future inbound path.
 * A plain `===` on a MAC leaks timing that can be walked to a forgery; length is
 * checked first because `timingSafeEqual` throws on a length mismatch.
 */
export function verifySignature(
  rawBody: string,
  signingSecret: string,
  signature: string
): boolean {
  const expected = signPayload(rawBody, signingSecret)
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}
