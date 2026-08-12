import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { isPublicAddress } from '@/lib/webhooks/ssrf'

describe('SSRF address classifier', () => {
  it('accepts genuinely public addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700:4700::1111']) {
      expect(isPublicAddress(ip), ip).toBe(true)
    }
  })

  it('rejects IPv4 private, loopback, and metadata ranges', () => {
    for (const ip of [
      '10.0.0.1',
      '10.255.255.255',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '127.0.0.1',
      '169.254.169.254', // cloud metadata
      '169.254.0.1',
      '0.0.0.0',
      '100.64.0.1', // CGNAT
      '198.18.0.1', // benchmarking
      '224.0.0.1', // multicast
      '255.255.255.255',
    ]) {
      expect(isPublicAddress(ip), ip).toBe(false)
    }
  })

  it('does not reject public addresses adjacent to private ranges', () => {
    // 172.15/172.32 are outside 172.16/12; 100.63/100.128 outside CGNAT.
    for (const ip of ['172.15.0.1', '172.32.0.1', '100.63.255.255', '100.128.0.1', '11.0.0.1']) {
      expect(isPublicAddress(ip), ip).toBe(true)
    }
  })

  it('rejects IPv6 loopback, ULA, and link-local', () => {
    for (const ip of ['::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1']) {
      expect(isPublicAddress(ip), ip).toBe(false)
    }
  })

  it('unwraps IPv4-mapped IPv6 so it cannot smuggle a private v4', () => {
    expect(isPublicAddress('::ffff:127.0.0.1')).toBe(false)
    expect(isPublicAddress('::ffff:10.0.0.1')).toBe(false)
    expect(isPublicAddress('::ffff:169.254.169.254')).toBe(false)
    expect(isPublicAddress('::ffff:8.8.8.8')).toBe(true)
  })

  it('rejects NAT64 and IPv4-compatible embeddings of private v4', () => {
    // NAT64 64:ff9b::/96 embedding metadata / private v4.
    expect(isPublicAddress('64:ff9b::a9fe:a9fe')).toBe(false) // hex form → conservative reject
    expect(isPublicAddress('64:ff9b::169.254.169.254')).toBe(false)
    expect(isPublicAddress('64:ff9b::10.0.0.1')).toBe(false)
    // Deprecated IPv4-compatible ::a.b.c.d and hex ::h:h forms.
    expect(isPublicAddress('::127.0.0.1')).toBe(false)
    expect(isPublicAddress('::7f00:1')).toBe(false) // hex 127.0.0.1 → conservative reject
    // A NAT64-wrapped PUBLIC v4 is still allowed by its v4.
    expect(isPublicAddress('64:ff9b::8.8.8.8')).toBe(true)
  })

  it('rejects unparseable input', () => {
    for (const bad of ['', 'not-an-ip', 'localhost', '999.999.999.999', '10.0.0']) {
      expect(isPublicAddress(bad), bad).toBe(false)
    }
  })
})
