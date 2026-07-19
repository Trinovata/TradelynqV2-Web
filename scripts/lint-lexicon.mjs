#!/usr/bin/env node
/**
 * Lexicon and banned-utility lint (v2/10 §10.3 + v2/02 §2.7, playbook S020).
 *
 * Enforces the parts of the canon a human reviewer reliably stops noticing by the
 * fortieth file: product vocabulary, Commonwealth spelling, currency format, and the
 * design system's banned utilities.
 *
 * ## Design note
 *
 * Precision is worth more than coverage here. A linter that cries wolf gets muted with
 * `--no-verify` inside a week, and a muted linter enforces nothing. So every rule is
 * scoped to the file types where it can actually be right, technical usages are
 * excluded, and any line can opt out explicitly:
 *
 *     const contractorRate = ... // lexicon-ok: DB column name, not user copy
 *
 * An opt-out requires a reason after the colon. "lexicon-ok" alone does not count —
 * if it is worth silencing, it is worth one clause saying why.
 *
 * Usage: node scripts/lint-lexicon.mjs [--quiet]
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname, relative } from 'node:path'

const ROOT = process.cwd()
const SCAN_DIRS = ['app', 'components', 'lib', 'emails']
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'coverage'])
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs'])
const STYLE_EXTENSIONS = new Set(['.css'])

/**
 * @typedef {object} Rule
 * @property {string} id
 * @property {RegExp} pattern
 * @property {string} message
 * @property {(ctx: {ext: string, line: string, path: string}) => boolean} [appliesTo]
 */

/** Lines that are pure imports, URLs, or technical identifiers rarely carry user copy. */
const isImportLine = (line) => /^\s*(import|export)\s/.test(line)
const isUrlLine = (line) => /https?:\/\//.test(line)

/**
 * Whether a line is comment-only. Used by rules that govern *rendered output*
 * specifically — an emoji in a JSDoc block is not an emoji in the UI, and a doc
 * comment explaining why `transition: all` is banned must be able to write those
 * words. Flagging either teaches contributors the linter is wrong, which is how
 * linters get muted.
 *
 * Set per line by the scanner, which tracks block-comment state: a CSS or JSDoc
 * block spans many lines and its continuation lines carry no `*` prefix, so a
 * per-line regex alone misses most of a block comment's body.
 */
function markCommentLines(lines) {
  const flags = new Array(lines.length).fill(false)
  let inBlock = false

  lines.forEach((line, index) => {
    const trimmed = line.trim()

    if (inBlock) {
      flags[index] = true
      // Reopening on the same line after a close keeps us inside.
      if (trimmed.includes('*/')) {
        inBlock = trimmed.lastIndexOf('/*') > trimmed.lastIndexOf('*/')
      }
      return
    }

    if (/^(\/\/|#)/.test(trimmed)) {
      flags[index] = true
      return
    }

    const opensBlock = trimmed.indexOf('/*')
    if (opensBlock !== -1) {
      // Comment-only if nothing precedes the opener on this line.
      flags[index] = opensBlock === 0
      inBlock = trimmed.lastIndexOf('/*') > trimmed.lastIndexOf('*/')
    }
  })

  return flags
}

/** @type {Rule[]} */
const RULES = [
  // ── Product vocabulary ─────────────────────────────────────────────────────
  {
    id: 'vocab/gig-worker',
    pattern: /\bgig[-\s]?workers?\b/i,
    message: 'Say "Professional". "Gig worker" is not what these people are, and they know it.',
  },
  {
    id: 'vocab/service-provider',
    pattern: /\bservice[-\s]providers?\b/i,
    message: 'Say "Professional", never "service provider".',
  },
  {
    id: 'vocab/tradespeople',
    pattern: /\btrades(people|person|men|man)\b/i,
    message:
      'Say "Professional". The platform spans beauty, creative, tech, and events — not only trades.',
  },
  {
    id: 'vocab/contractor',
    pattern: /\bcontractors?\b/i,
    message: 'Say "Professional", never "contractor".',
    // "contract" and "smart contract" are fine; only the person-noun is banned.
    appliesTo: ({ line }) => !isImportLine(line),
  },

  // ── Commonwealth English ───────────────────────────────────────────────────
  {
    id: 'spelling/inquiry',
    pattern: /\binquir(y|ies|e|ing)\b/i,
    message: 'Commonwealth English: "enquiry", not "inquiry".',
  },
  {
    id: 'spelling/organization',
    pattern: /\borganiz(ation|ations|e|ed|ing)\b/i,
    message: 'Commonwealth English: "organisation", not "organization".',
  },
  {
    id: 'spelling/recognize',
    pattern: /\brecogniz(e|ed|es|ing)\b/i,
    message: 'Commonwealth English: "recognise", not "recognize".',
  },
  {
    id: 'spelling/color-in-prose',
    // Only prose. A `color` preceded by a hyphen is a Tailwind utility
    // (`transition-colors`, `text-color`) or a CSS property, never user copy.
    pattern: /(?<![-\w])colou?rs?(?![-\w])/i,
    message: 'Commonwealth English in UI copy: "colour", not "color". (CSS properties are exempt.)',
    appliesTo: ({ ext, line }) => {
      if (!CODE_EXTENSIONS.has(ext)) return false
      if (isImportLine(line) || isUrlLine(line)) return false
      // Technical contexts where "color" is an API, not a word.
      if (
        /(?:background|border|text|fill|stroke|accent|caret|outline)?-?[Cc]olor\s*[:=]/.test(line)
      )
        return false
      if (/colorScheme|prefers-color-scheme|color-mix|colorMode|transition-colors/.test(line))
        return false
      // Only flag the American spelling; "colour" is what we want and must not warn.
      return /(?<![-\w])colors?(?![-\w])/.test(line)
    },
  },

  // ── Marketing slop (the anti-slop covenant) ────────────────────────────────
  {
    id: 'slop/seamless',
    pattern: /\bseamless(ly)?\b/i,
    message: 'Banned marketing filler: "seamless". Say what actually happens.',
  },
  {
    id: 'slop/unlock-the-power',
    pattern: /\bunlock the (power|potential)\b/i,
    message: 'Banned marketing filler. Name the concrete benefit instead.',
  },
  {
    id: 'slop/next-level',
    pattern: /\b(take|taking) (it|your \w+) to the next level\b/i,
    message: 'Banned marketing filler. Name the concrete benefit instead.',
  },
  {
    id: 'slop/elevate',
    pattern: /\belevate your\b/i,
    message: 'Banned marketing filler. Name the concrete benefit instead.',
  },

  // ── Placeholder copy ───────────────────────────────────────────────────────
  {
    id: 'placeholder/lorem',
    pattern: /\blorem ipsum\b/i,
    message: 'Placeholder copy must not ship. The copy decks contain the real string.',
  },
  {
    id: 'placeholder/todo-copy',
    pattern: /\b(TODO|FIXME)[\s:]*copy\b/i,
    message: 'Placeholder copy must not ship. Check the copy deck for this surface.',
  },
  {
    id: 'placeholder/generic-empty',
    pattern: /["'`]\s*(No data|No results|Something went wrong|Click here)\s*["'`]/i,
    message:
      'Generic filler. Every EmptyState and error writes surface-specific copy (v2/02 §2.5).',
    // Exempt comments: the EmptyState component's own docs quote "No results" as
    // the example of what NOT to write. Prose about a rule is not a breach of it.
    appliesTo: ({ isComment }) => isComment !== true,
  },

  // ── Currency ───────────────────────────────────────────────────────────────
  {
    id: 'currency/bare-dollar',
    // A literal dollar sign against a number ("$500"), or a literal `$` immediately
    // before a template interpolation ("$${amount}") — the two ways bare currency
    // actually reaches a screen.
    //
    // Plain `${...}` is JavaScript string interpolation, not money, and matching it
    // would flag most template literals in the codebase. That was this rule's first
    // version and it produced 12 false positives against zero real ones.
    pattern: /\$\s*\d|\$\$\{/,
    message: 'Money renders as "TTD $X,XXX" via formatTTD(). Never a bare $ in UI copy.',
    appliesTo: ({ line, isComment }) =>
      !/TTD/.test(line) &&
      !isImportLine(line) &&
      !isUrlLine(line) &&
      !/formatTTD/.test(line) &&
      // Prose about the rule is not a breach of it — the doc comment on
      // formatTTD necessarily quotes a bare "$2,100" to explain why it is banned.
      isComment !== true &&
      // Regex character classes and shell-style vars legitimately contain `$`.
      !/\$\d\s*[|)\]]/.test(line),
  },

  // ── Design system: banned utilities ────────────────────────────────────────
  // The design rules below govern rendered output, so comments are exempt: a
  // doc comment that explains why `transition: all` is banned must be able to
  // write the words `transition: all`. Flagging that teaches contributors the
  // linter is wrong, which is how linters get muted.
  {
    id: 'design/transition-all',
    pattern: /transition-all|transition:\s*all/,
    message: 'Only transform and opacity animate, via named properties (DESIGN.md §5).',
    appliesTo: ({ isComment }) => isComment !== true,
  },
  {
    id: 'design/literal-hex',
    pattern: /#[0-9a-fA-F]{3,8}\b/,
    message: 'Semantic tokens only — no literal hex in components. Define it in globals.css.',
    // Token definitions live in CSS; the ban is on components consuming raw values.
    appliesTo: ({ ext, path, isComment }) =>
      CODE_EXTENSIONS.has(ext) &&
      (path.startsWith('components') || path.startsWith('app')) &&
      isComment !== true,
  },
  {
    id: 'design/literal-slate',
    pattern: /\b(?:bg|text|border|ring|divide)-(?:slate|gray|grey|zinc|neutral|stone)-\d{2,3}\b/,
    message: 'Semantic tokens only: bg-card, text-body, text-muted, border-border (DESIGN.md §1).',
    appliesTo: ({ isComment }) => isComment !== true,
  },
  {
    id: 'design/bg-white',
    pattern: /\bbg-white\b/,
    message: 'Use bg-card. bg-white has no dark-mode counterpart.',
    appliesTo: ({ isComment }) => isComment !== true,
  },
  {
    id: 'design/violet',
    pattern: /\b(?:bg|text|border|ring)-(?:violet|purple)-\d{2,3}\b|--domain-business/,
    message: 'Violet is retired platform-wide (D32). Registered Businesses differentiate by badge.',
  },
  {
    id: 'design/emoji-in-ui',
    pattern: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
    message: 'No emoji in UI (the anti-slop covenant). Use a lucide icon.',
    appliesTo: ({ ext, path, isComment }) =>
      CODE_EXTENSIONS.has(ext) &&
      (path.startsWith('components') || path.startsWith('app')) &&
      isComment !== true,
  },
]

// ── Scanner ──────────────────────────────────────────────────────────────────

function collectFiles(dir, acc = []) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      collectFiles(full, acc)
    } else {
      const ext = extname(full)
      if (CODE_EXTENSIONS.has(ext) || STYLE_EXTENSIONS.has(ext)) acc.push(full)
    }
  }
  return acc
}

/** A line opts out with `lexicon-ok: <reason>` — the reason is mandatory. */
function hasValidOptOut(line) {
  const match = line.match(/lexicon-ok:\s*(.+)/)
  return Boolean(match && match[1] && match[1].trim().length > 3)
}

function scan() {
  const violations = []
  const files = SCAN_DIRS.flatMap((d) => collectFiles(join(ROOT, d)))

  for (const file of files) {
    const path = relative(ROOT, file).replace(/\\/g, '/')
    const ext = extname(file)
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    const commentFlags = markCommentLines(lines)

    lines.forEach((line, index) => {
      if (hasValidOptOut(line)) return

      const isComment = commentFlags[index] === true

      for (const rule of RULES) {
        if (rule.appliesTo && !rule.appliesTo({ ext, line, path, isComment })) continue
        if (!rule.pattern.test(line)) continue

        violations.push({
          path,
          line: index + 1,
          rule: rule.id,
          message: rule.message,
          excerpt: line.trim().slice(0, 120),
        })
      }
    })
  }

  return { violations, fileCount: files.length }
}

// ── Report ───────────────────────────────────────────────────────────────────

const quiet = process.argv.includes('--quiet')
const { violations, fileCount } = scan()

if (violations.length === 0) {
  if (!quiet) console.log(`✓ Lexicon lint clean — ${fileCount} files scanned, 0 violations.`)
  process.exit(0)
}

console.error(`\n✗ Lexicon lint: ${violations.length} violation(s) across ${fileCount} files.\n`)

const byRule = new Map()
for (const v of violations) {
  if (!byRule.has(v.rule)) byRule.set(v.rule, [])
  byRule.get(v.rule).push(v)
}

for (const [rule, items] of byRule) {
  console.error(`  ${rule} — ${items[0].message}`)
  for (const item of items) {
    console.error(`    ${item.path}:${item.line}`)
    console.error(`      ${item.excerpt}`)
  }
  console.error('')
}

console.error('If a match is a false positive, opt the line out with a reason:')
console.error('    // lexicon-ok: DB column name, not user copy\n')

process.exit(1)
