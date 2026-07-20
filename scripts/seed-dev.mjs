#!/usr/bin/env node
/**
 * Seeds the local development database (playbook S046).
 *
 * Deliberately mirrors `test-policies.mjs`: it resolves the local
 * `supabase_db_*` container and pipes SQL through `docker exec … psql`. Two
 * reasons that matters more than convenience.
 *
 * 1. **No credentials.** A seed written against the JS client would need the
 *    service-role key, which means reading `.env` — something agents working in
 *    this repo are forbidden from doing, and a habit worth not forming.
 * 2. **It cannot reach production.** The connection is a local Docker container
 *    by construction. There is no host or URL to mistype, so the classic
 *    "seeded the wrong database" accident is not available.
 *
 * The SQL itself deletes only the `5eed…` UUID namespace it created — no
 * TRUNCATE, no unqualified DELETE — so re-running is safe and idempotent.
 *
 * Usage: npm run db:seed
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'

const SEED_FILE = join(process.cwd(), 'supabase', 'seed-dev.sql')

function resolveDbContainer() {
  let out
  try {
    // execFileSync, not execSync: no shell, so nothing here can be reinterpreted
    // as a command even if the format string changes later.
    out = execFileSync('docker', ['ps', '--format', '{{.Names}}'], { encoding: 'utf8' })
  } catch {
    console.error('✗ Could not reach Docker. Is Docker Desktop running?')
    process.exit(1)
  }

  const container = out
    .split('\n')
    .map((line) => line.trim())
    .find((name) => name.startsWith('supabase_db_'))

  if (!container) {
    console.error('✗ No running supabase_db_* container found.')
    console.error('  Start the local stack first:  npx supabase start')
    process.exit(1)
  }

  return container
}

let sql
try {
  sql = readFileSync(SEED_FILE, 'utf8')
} catch {
  console.error(`✗ Seed file not found at ${SEED_FILE}`)
  process.exit(1)
}

const container = resolveDbContainer()

console.log(`Seeding ${container} from supabase/seed-dev.sql\n`)

const result = spawnSync(
  'docker',
  [
    'exec',
    '-i',
    container,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-q',
  ],
  { input: sql, encoding: 'utf8' }
)

const output = `${result.stdout ?? ''}${result.stderr ?? ''}`

if (result.status !== 0) {
  console.error('✗ Seed failed.\n')
  for (const line of output.split('\n')) {
    if (line.trim()) console.error(`    ${line}`)
  }
  process.exit(1)
}

console.log(output.trim())
console.log('\n✓ Seed applied. Sign in as any seeded account with password: devpassword123')
