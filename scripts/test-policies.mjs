#!/usr/bin/env node
/**
 * Runs the SQL policy suites against the local Supabase database (playbook S047).
 *
 * These assert security properties by exercising them. A migration applying
 * cleanly says nothing about whether its RLS works — the first run of the
 * profiles suite found both a missing GRANT that would have broken the app
 * entirely, and a test that passed for the wrong reason.
 *
 * Every future migration adds its suite to tests/sql/. This is permanent.
 *
 * Usage: npm run test:policies      (requires `npx supabase start`)
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'

const SQL_DIR = join(process.cwd(), 'tests', 'sql')

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

function listSuites() {
  try {
    return readdirSync(SQL_DIR)
      .filter((file) => file.endsWith('.sql'))
      .sort()
  } catch {
    console.error(`✗ No SQL suites found at ${SQL_DIR}`)
    process.exit(1)
  }
}

const container = resolveDbContainer()
const suites = listSuites()

if (suites.length === 0) {
  console.error('✗ tests/sql contains no .sql suites.')
  process.exit(1)
}

console.log(`Running ${suites.length} policy suite(s) against ${container}\n`)

let failed = 0

for (const suite of suites) {
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
    { input: readFileSync(join(SQL_DIR, suite), 'utf8'), encoding: 'utf8' }
  )

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`

  if (result.status === 0) {
    const passes = output.split('\n').filter((line) => line.includes('PASS ')).length
    console.log(`  ✓ ${suite} — ${passes} check(s) passed`)
  } else {
    failed += 1
    console.error(`  ✗ ${suite} FAILED`)
    for (const line of output.split('\n')) {
      if (line.trim()) console.error(`      ${line}`)
    }
  }
}

console.log('')

if (failed > 0) {
  console.error(`✗ ${failed} policy suite(s) failed.`)
  process.exit(1)
}

console.log('✓ All policy suites passed.')
