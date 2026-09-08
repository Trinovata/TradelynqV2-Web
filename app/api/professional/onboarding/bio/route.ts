/**
 * POST /api/professional/onboarding/bio (playbook S107,
 * copy `copy-professional.md §4.2`).
 *
 * Three bio drafts from a handful of keywords. The deck's promise is "first
 * draft is free" — this route charges nothing at all.
 *
 * ## Why this is not a credit-metered AI tool (D62)
 *
 * D62 withholds the AI *business* tools at launch: reply drafts and the
 * assistant, both metered against `tool_credits`. This is not one of those. It
 * is an onboarding aid that runs once or twice in a professional's lifetime,
 * before they have an account worth metering, and the bio is the field the
 * whole storefront lives or dies on. Metering it would mean charging someone to
 * finish signing up. FLAG for a D-entry: if that reading is wrong, delete the
 * route — the wizard degrades to a plain textarea with no other change.
 *
 * The abuse ceiling is the `ai` rate limiter plus the professional-role guard,
 * so the cost surface is "signed-in professionals, a few calls each".
 *
 * ## Two sources, one shape
 *
 * With `ANTHROPIC_API_KEY`, Claude writes three drafts. Without it, three
 * template drafts are composed from the same inputs. Both return the same
 * `{ options: string[] }`, so the flow is verifiable today and gets better —
 * not different — when the key lands. Same doctrine as Lynq (S094).
 */
import { z } from 'zod'
import { requireRole } from '@/lib/access/api'
import { checkRateLimit, identifierFrom } from '@/lib/rate-limit'
import { err, ok } from '@/lib/api/errors'
import { logger } from '@/lib/utils/logger'
import { BIO_MAX, BIO_MIN } from '@/lib/professional/onboarding'

const MODEL = 'claude-sonnet-5'
const MAX_TOKENS = 700

const bodySchema = z.object({
  keywords: z.string().trim().max(200),
  businessName: z.string().trim().max(80),
  category: z.string().trim().max(80).nullable(),
  areas: z.array(z.string().trim().max(60)).max(4),
  yearsExperience: z.number().int().min(0).max(70).nullable(),
})

type BioInputs = z.infer<typeof bodySchema>

/**
 * The no-key path. Three genuinely different openings — what you do, how long
 * you have done it, who you serve — because three variations on one sentence is
 * a worse answer than one good sentence.
 */
function templateDrafts(input: BioInputs): string[] {
  const name = input.businessName.trim() || 'We'
  const trade = input.category?.toLowerCase() ?? 'work'
  const areaList =
    input.areas.length > 1
      ? `${input.areas.slice(0, -1).join(', ')} and ${input.areas[input.areas.length - 1]}`
      : (input.areas[0] ?? 'Trinidad and Tobago')
  const years = input.yearsExperience
  const keywordClause = input.keywords
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 4)

  const specialities = keywordClause.length > 0 ? keywordClause.join(', ') : trade

  const drafts = [
    `${name} handles ${specialities} across ${areaList}. ` +
      `Straight answers on what a job needs, a price before the work starts, and a finish you don't have to call anyone back about. ` +
      `Message us on WhatsApp and we'll tell you honestly whether it's a job for us.`,

    years !== null && years > 0
      ? `${years} ${years === 1 ? 'year' : 'years'} of ${trade} in ${areaList}. ` +
        `${name} takes on ${specialities} — the everyday jobs and the ones other people have already tried. ` +
        `You'll get a clear quote, a time we actually keep, and work that holds up.`
      : `${name} is a ${trade} business serving ${areaList}. ` +
        `We take on ${specialities}, quote before we start, and turn up when we say we will. ` +
        `New to TradeLynq, not new to the work.`,

    `Looking for ${trade} in ${areaList}? ${name} covers ${specialities}. ` +
      `We're the people you call when you want it done once, properly, by someone who'll pick up the phone afterwards.`,
  ]

  // The storefront's own limit, so a draft can be used exactly as returned.
  return drafts.map((draft) => draft.slice(0, BIO_MAX))
}

const SYSTEM_PROMPT = `You write short business bios for professionals on TradeLynq, a Trinidad & Tobago services marketplace.

Rules:
- Commonwealth English spellings (colour, organisation, recognise, licence).
- Between ${BIO_MIN} and ${BIO_MAX} characters. Never exceed ${BIO_MAX}.
- Plain, grounded, specific. No marketing superlatives, no "passionate", no "we pride ourselves".
- Never invent qualifications, certifications, awards, insurance, or client names.
- Never claim years of experience unless given.
- Write in the voice the professional would use with a customer on WhatsApp.
- No emoji. No hashtags. No headings.

Return EXACTLY three bios, separated by a line containing only ---. No numbering, no preamble.`

export async function POST(request: Request) {
  // `ai_tool`, not `api`: this is the only route in onboarding that costs money
  // per call, so it takes the model-spend bucket. Its rationale names tool
  // credits as "the real bound" — this route has none, so the limiter plus the
  // template fallback below are the whole ceiling. Deliberate, and narrow: a
  // signed-in professional, twenty calls a minute, at onboarding only.
  const limit = await checkRateLimit('ai_tool', identifierFrom(request))
  if (!limit.ok) return limit.response

  const access = await requireRole(['professional'], request)
  if (!access.ok) return access.response

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return err('INVALID_INPUT', { fieldErrors: {}, formErrors: ['Send a JSON body.'] })
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    return err('INVALID_INPUT', { fieldErrors: flat.fieldErrors, formErrors: flat.formErrors })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  // A degraded limiter means the limit was never verified. On a paid route that
  // is unmetered spend, so it answers from templates instead — same reasoning
  // as the chatbot's fallback, same outcome: the feature works, the wallet is shut.
  if (!apiKey || limit.degraded) {
    return ok({ options: templateDrafts(parsed.data), source: 'template' })
  }

  const input = parsed.data
  const facts = [
    `Business name: ${input.businessName || 'not given'}`,
    `Trade: ${input.category ?? 'not given'}`,
    `Areas served: ${input.areas.length > 0 ? input.areas.join(', ') : 'not given'}`,
    `Years of experience: ${input.yearsExperience ?? 'not given'}`,
    `Their own words: ${input.keywords || 'not given'}`,
  ].join('\n')

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: 'disabled' },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: facts }],
      }),
    })

    if (!upstream.ok) {
      logger.error('onboarding_bio:upstream_error', { status: upstream.status })
      return ok({ options: templateDrafts(input), source: 'template' })
    }

    const payload = (await upstream.json()) as {
      content?: Array<{ type: string; text?: string }>
    }
    const text = (payload.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('')

    const options = text
      .split(/^\s*-{3,}\s*$/m)
      .map((option) => option.trim())
      .filter((option) => option.length >= BIO_MIN)
      .slice(0, 3)
      .map((option) => option.slice(0, BIO_MAX))

    // A malformed response is not worth surfacing as an error when a usable
    // answer is one function call away.
    if (options.length === 0) {
      return ok({ options: templateDrafts(input), source: 'template' })
    }

    return ok({ options, source: 'live' })
  } catch (error) {
    logger.error('onboarding_bio:request_failed', { error: String(error) })
    return ok({ options: templateDrafts(input), source: 'template' })
  }
}
