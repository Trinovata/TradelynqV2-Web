/**
 * Dependency audit gate (playbook S021 hardening; replaces the bare
 * `npm audit --audit-level=high` CI step, 26 Jul 2026).
 *
 * Why this exists rather than `npm audit --audit-level=high` alone:
 * `npm audit` is all-or-nothing. When a high advisory lands that (a) affects
 * only dev/build tooling with no production runtime attack surface and (b)
 * has no fix that does not break the toolchain, the bare command wedges CI
 * red with no lever short of weakening the gate for EVERYTHING. This gate
 * keeps the high bar for every advisory except a small, EXPLICIT allowlist —
 * each entry carrying a reason and a review date, so an exception is a
 * visible decision in git, never a silent downgrade.
 *
 * The allowlist is deliberately narrow: only advisories that are dev-only AND
 * unfixable-without-breakage belong here. Anything with a production surface,
 * or a clean fix, must be fixed — not listed.
 */
import { execFileSync } from 'node:child_process'

/**
 * Allowlisted advisories. Keyed by the advisory URL (stable, unlike numeric
 * ids). Each MUST justify both halves of the test: dev-only, and no safe fix.
 */
const ALLOW = [
  {
    url: 'https://github.com/advisories/GHSA-mh99-v99m-4gvg',
    package: 'brace-expansion',
    reason:
      'DoS in brace-pattern expansion, reachable only through eslint/glob build tooling — not the deployed runtime. The only fixed version (5.0.8) changes the export shape and breaks the minimatch that eslint-config-next@16 (pinned to eslint 9) bundles; eslint 10 is the offered fix but breaks eslint-config-next’s react plugin. No safe fix until eslint-config-next supports eslint 10.',
    review: '2026-10-01',
  },
]

const raw = (() => {
  // Run npm's CLI JS directly through the current node — no shell, and no
  // Windows `.cmd` spawn (which errors EINVAL since Node's shell-less-.cmd
  // security change). `npm_execpath` is set whenever this runs via `npm run`.
  const npmCli = process.env.npm_execpath
  const args = npmCli
    ? [npmCli, 'audit', '--json']
    : // Fallback for a bare `node scripts/audit-gate.mjs`: shell out to npm with
      // a fixed, non-interpolated arg list.
      null
  try {
    if (args) {
      return execFileSync(process.execPath, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
    }
    return execFileSync('npm', ['audit', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: process.platform === 'win32',
    })
  } catch (error) {
    // npm audit exits non-zero when advisories exist; the JSON is still on stdout.
    return error.stdout?.toString() ?? ''
  }
})()

if (!raw.trim()) {
  console.error('audit-gate: no audit output — treating as failure.')
  process.exit(1)
}

const report = JSON.parse(raw)
const vulns = report.vulnerabilities ?? {}
const allowUrls = new Set(ALLOW.map((a) => a.url))
const BLOCKING = new Set(['high', 'critical'])

/**
 * Every advisory URL in a vuln's transitive `via` closure. `via` mixes
 * advisory objects (which carry the url) with package-name strings that point
 * at ANOTHER vulnerable package — so a parent like `minimatch` only reaches
 * the advisory by following its string reference down to `brace-expansion`.
 * Cycle-guarded by `seen`.
 */
function advisoryClosure(name, seen = new Set()) {
  if (seen.has(name)) return []
  seen.add(name)
  const vuln = vulns[name]
  if (!vuln) return []
  const urls = []
  for (const via of vuln.via ?? []) {
    if (typeof via === 'object' && via.url) urls.push(via.url)
    else if (typeof via === 'string') urls.push(...advisoryClosure(via, seen))
  }
  return urls
}

const offenders = []
for (const [name, vuln] of Object.entries(vulns)) {
  if (!BLOCKING.has(vuln.severity)) continue
  const urls = [...new Set(advisoryClosure(name))]
  // Covered only if it HAS advisories and ALL of them are allowlisted — a vuln
  // whose closure resolves to nothing is never silently waived.
  const covered = urls.length > 0 && urls.every((u) => allowUrls.has(u))
  if (!covered) offenders.push({ name, severity: vuln.severity, urls })
}

// Report what was waived, so an allowlisted advisory is visible in CI logs.
for (const entry of ALLOW) {
  console.log(`audit-gate: waived ${entry.package} (${entry.url}) — review by ${entry.review}`)
}

if (offenders.length > 0) {
  console.error('\naudit-gate: blocking high/critical advisories (not allowlisted):')
  for (const o of offenders) {
    console.error(`  - ${o.name} [${o.severity}] ${o.urls.join(', ')}`)
  }
  console.error('\nFix them, or (dev-only + unfixable) add an explicit allowlist entry.')
  process.exit(1)
}

console.log('\naudit-gate: no blocking advisories. ✓')
