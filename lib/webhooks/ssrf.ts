import 'server-only'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/**
 * SSRF guard for outbound webhook URLs (playbook S116, security review 28 Jul).
 *
 * A webhook endpoint is a URL the *customer* chooses and *our server* fetches —
 * the textbook SSRF sink. Without this, an Enterprise account could point an
 * endpoint at `https://169.254.169.254/…` (cloud metadata), `https://10.x`, or
 * `https://localhost` and read the response back out of their own delivery log,
 * turning our dispatcher into a proxy into our private network.
 *
 * Two properties make the guard actually hold:
 *
 *   1. **It validates the RESOLVED addresses, never the hostname string.** A
 *      hostname, an integer-encoded IP, or an octal literal can all disguise a
 *      private address; only the address DNS returns tells the truth. IPv4-mapped
 *      IPv6 (`::ffff:127.0.0.1`) is unwrapped so it cannot smuggle a private v4.
 *
 *   2. **It is checked at BOTH config time and dispatch time.** DNS is mutable:
 *      a name that resolves to a public IP when the endpoint is created can be
 *      re-pointed to `127.0.0.1` before an event fires (DNS rebinding). The
 *      config-time check is UX (a fast, clear rejection); the dispatch-time check
 *      is the security boundary.
 *
 * A residual window remains between our resolve and undici's own resolve inside
 * `fetch` (a rebinding attacker could flip DNS in those milliseconds). Fully
 * closing it means pinning the validated IP into the fetch connector — the
 * hardening follow-up. This guard removes the entire practical attack surface
 * (static private targets, integer/octal encodings, mapped addresses, rebinding
 * across the create→dispatch gap) that a bare HTTPS check leaves open.
 */

export type UrlCheck = { ok: true } | { ok: false; reason: string }

const GENERIC = 'Endpoint must be a public HTTPS address.'

/** Validate that a URL is safe to fetch — public host, HTTPS, no credentials. */
export async function checkPublicUrl(rawUrl: string): Promise<UrlCheck> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, reason: 'Enter a valid URL.' }
  }

  if (url.protocol !== 'https:') return { ok: false, reason: 'Endpoint must use HTTPS.' }

  // Credentials in the URL are a redirect/smuggling vector and never needed for a
  // webhook — a signed body authenticates us, not basic-auth in the URL.
  if (url.username !== '' || url.password !== '') {
    return { ok: false, reason: 'Endpoint URL must not contain credentials.' }
  }

  const host = url.hostname
  const literalVersion = isIP(host) // 0 unless the host is itself an IP literal

  // A bare name with no dot (localhost, an internal service name, an
  // integer-encoded IP like `2130706433`) is never a public endpoint.
  if (literalVersion === 0 && !host.includes('.')) {
    return { ok: false, reason: GENERIC }
  }

  let addresses: string[]
  if (literalVersion !== 0) {
    addresses = [host]
  } else {
    try {
      const resolved = await lookup(host, { all: true })
      addresses = resolved.map((r) => r.address)
    } catch {
      return { ok: false, reason: 'Endpoint host could not be resolved.' }
    }
  }

  if (addresses.length === 0) return { ok: false, reason: 'Endpoint host could not be resolved.' }

  // Every resolved address must be public. One private answer (split-horizon or a
  // rebinding attempt) rejects the whole endpoint.
  for (const address of addresses) {
    if (!isPublicAddress(address)) return { ok: false, reason: GENERIC }
  }

  return { ok: true }
}

/** True only for a routable, public unicast address. Exported for tests. */
export function isPublicAddress(ip: string): boolean {
  const version = isIP(ip)
  if (version === 4) return isPublicIPv4(ip)
  if (version === 6) return isPublicIPv6(ip)
  return false // unparseable — never trusted
}

function isPublicIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p))
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false
  }
  const [a, b] = parts as [number, number, number, number]

  if (a === 0) return false // 0.0.0.0/8 "this network"
  if (a === 10) return false // private
  if (a === 127) return false // loopback
  if (a === 169 && b === 254) return false // link-local, incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return false // private
  if (a === 192 && b === 168) return false // private
  if (a === 192 && b === 0) return false // 192.0.0.0/24 (protocol) + 192.0.2.0/24 (test)
  if (a === 100 && b >= 64 && b <= 127) return false // CGNAT 100.64.0.0/10
  if (a === 198 && (b === 18 || b === 19)) return false // benchmarking 198.18.0.0/15
  if (a >= 224) return false // multicast 224/4, reserved 240/4, 255.255.255.255

  return true
}

function isPublicIPv6(ip: string): boolean {
  const addr = (ip.toLowerCase().split('%')[0] ?? '').trim() // strip any zone id

  if (addr === '::1' || addr === '::') return false // loopback / unspecified

  // Any IPv6 that EMBEDS an IPv4 address must be judged by that v4, or it becomes
  // an SSRF bypass. Three forms carry a v4: `::ffff:<v4>` (mapped), `::<v4>`
  // (deprecated IPv4-compatible), and `64:ff9b::<v4>` (NAT64). All start with
  // `::` or the NAT64 prefix; a dotted tail is the v4 to unwrap and defer to the
  // v4 classifier. A `::`-prefixed or NAT64 address WITHOUT a dotted tail carries
  // its v4 in hex (or is another special-use range) — too varied to parse safely,
  // so reject it outright rather than risk letting a private target through.
  if (addr.startsWith('::') || addr.startsWith('64:ff9b:')) {
    const dotted = addr.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
    return dotted ? isPublicIPv4(dotted[1]!) : false
  }

  const firstHextet = addr.split(':')[0] ?? ''
  if (firstHextet === '') return false // any other zero-prefixed special range
  if (firstHextet.startsWith('fc') || firstHextet.startsWith('fd')) return false // ULA fc00::/7
  if (/^fe[89ab]/.test(firstHextet)) return false // link-local fe80::/10
  if (firstHextet.startsWith('ff')) return false // multicast ff00::/8

  return true
}
