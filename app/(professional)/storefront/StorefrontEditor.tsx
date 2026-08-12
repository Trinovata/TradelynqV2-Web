'use client'

/**
 * Storefront editor (playbook S113, spec 05 §5.8) — the customisable heart of
 * the workspace. Intuitive + efficient by design:
 *  - one PATCH endpoint, saved per section so a professional edits one thing
 *    and commits it without a page-wide "Save everything" gamble;
 *  - a dirty-state Save button that enables only when something changed and
 *    confirms with an inline "Saved" tick — no modal, no page reload;
 *  - services as an add/remove line editor (same ergonomics as the quote
 *    composer), areas as removable chips, hours as seven day rows.
 * Everything is optimistic-feeling but server-confirmed; a failed save says so
 * and keeps the edits so nothing is lost.
 */
import * as React from 'react'
import { Plus, Trash2, Check, X } from 'lucide-react'
import { Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { formatTTD } from '@/lib/utils/format'
import type { StorefrontEditModel, StorefrontService } from '@/lib/professional/storefront'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAY_LABEL: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** A section wrapper: heading, its fields, and a save control that only lights
 *  up when the section is dirty. The premium-restraint card — flat at rest. */
function Section({
  title,
  description,
  dirty,
  state,
  onSave,
  children,
}: {
  title: string
  description?: string
  dirty: boolean
  state: SaveState
  onSave: () => void
  children: React.ReactNode
}) {
  return (
    <section className="border-border bg-card rounded-[--radius-card] border p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-foreground font-medium">{title}</h2>
          {description && <p className="text-muted mt-0.5 text-sm">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {state === 'saved' && (
            <span className="text-success inline-flex items-center gap-1 text-xs">
              <Check className="size-3.5" aria-hidden="true" />
              Saved
            </span>
          )}
          {state === 'error' && <span className="text-destructive text-xs">Couldn’t save</span>}
          <Button
            size="sm"
            variant="secondary"
            onClick={onSave}
            disabled={!dirty && state !== 'error'}
            isLoading={state === 'saving'}
            loadingLabel="Saving…"
          >
            Save
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

export function StorefrontEditor({ initial }: { initial: StorefrontEditModel }) {
  return (
    <div className="flex flex-col gap-4">
      <IdentitySection initial={initial} />
      <ServicesSection initial={initial.services} />
      <AreasSection initial={initial.serviceAreas} />
      <HoursSection initial={initial.businessHours} />
      <ContactSection initial={initial} />
    </div>
  )
}

/** One save primitive shared by every section — PATCH the changed slice. */
function usePatch() {
  const [state, setState] = React.useState<SaveState>('idle')
  const save = React.useCallback(async (payload: Record<string, unknown>) => {
    setState('saving')
    try {
      const res = await fetch('/api/professional/storefront', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        setState('saved')
        setTimeout(() => setState('idle'), 2500)
        return true
      }
      setState('error')
      return false
    } catch {
      setState('error')
      return false
    }
  }, [])
  return { state, save }
}

function IdentitySection({ initial }: { initial: StorefrontEditModel }) {
  const [tagline, setTagline] = React.useState(initial.tagline)
  const [bio, setBio] = React.useState(initial.bio)
  const { state, save } = usePatch()
  const dirty = tagline !== initial.tagline || bio !== initial.bio

  return (
    <Section
      title="About"
      description="The first thing a customer reads."
      dirty={dirty}
      state={state}
      onSave={() => save({ tagline, bio })}
    >
      <Input
        label="Tagline"
        placeholder="Reliable plumbing across the East–West corridor"
        value={tagline}
        maxLength={140}
        onChange={(e) => setTagline(e.target.value)}
      />
      <Textarea
        label="Bio"
        placeholder="Tell customers who you are and what you do best."
        rows={5}
        value={bio}
        maxLength={2000}
        onChange={(e) => setBio(e.target.value)}
      />
    </Section>
  )
}

function ServicesSection({ initial }: { initial: StorefrontService[] }) {
  const [rows, setRows] = React.useState<StorefrontService[]>(
    initial.length ? initial : [{ name: '' }]
  )
  const { state, save } = usePatch()
  const dirty = JSON.stringify(rows) !== JSON.stringify(initial.length ? initial : [{ name: '' }])

  const set = (i: number, patch: Partial<StorefrontService>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  return (
    <Section
      title="Services & prices"
      description="What you offer, and what it costs. Prices show as TTD."
      dirty={dirty}
      state={state}
      onSave={() =>
        save({
          services: rows
            .filter((r) => r.name.trim())
            .map((r) => ({
              name: r.name.trim(),
              price_ttd: typeof r.price_ttd === 'number' ? r.price_ttd : undefined,
              description: r.description?.trim() || undefined,
            })),
        })
      }
    >
      <ul className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <li key={i} className="flex items-start gap-2">
            <div className="flex-1">
              <Input
                aria-label={`Service ${i + 1} name`}
                placeholder="Deep clean — 3-bedroom"
                value={row.name}
                onChange={(e) => set(i, { name: e.target.value })}
              />
            </div>
            <div className="w-28">
              <Input
                aria-label={`Service ${i + 1} price TTD`}
                type="number"
                min={0}
                placeholder="Price"
                value={row.price_ttd ?? ''}
                onChange={(e) =>
                  set(i, { price_ttd: e.target.value === '' ? undefined : Number(e.target.value) })
                }
                className="font-mono tabular-nums"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, x) => x !== i)))
              }
              disabled={rows.length === 1}
              aria-label={`Remove service ${i + 1}`}
              className="text-muted hover:text-destructive mt-2.5 disabled:opacity-30"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, { name: '' }])}
        className="text-accent-ink inline-flex items-center gap-1 text-sm"
      >
        <Plus className="size-4" aria-hidden="true" />
        Add a service
      </button>
    </Section>
  )
}

function AreasSection({ initial }: { initial: string[] }) {
  const [areas, setAreas] = React.useState<string[]>(initial)
  const [draft, setDraft] = React.useState('')
  const { state, save } = usePatch()
  const dirty = JSON.stringify(areas) !== JSON.stringify(initial)

  const add = () => {
    const v = draft.trim()
    if (v && !areas.includes(v)) setAreas((prev) => [...prev, v])
    setDraft('')
  }

  return (
    <Section
      title="Areas you serve"
      description="Where customers can find you in search."
      dirty={dirty}
      state={state}
      onSave={() => save({ service_areas: areas })}
    >
      {areas.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {areas.map((area) => (
            <li key={area}>
              <span className="border-border bg-card-subtle text-body inline-flex items-center gap-1.5 rounded-full border py-1 pr-1.5 pl-3 text-sm">
                {area}
                <button
                  type="button"
                  onClick={() => setAreas((prev) => prev.filter((a) => a !== area))}
                  aria-label={`Remove ${area}`}
                  className="text-muted hover:text-destructive"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          aria-label="Add an area"
          placeholder="Chaguanas"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <Button variant="secondary" onClick={add} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </Section>
  )
}

function HoursSection({ initial }: { initial: Record<string, string> }) {
  const [hours, setHours] = React.useState<Record<string, string>>(initial)
  const { state, save } = usePatch()
  const dirty = JSON.stringify(hours) !== JSON.stringify(initial)

  return (
    <Section
      title="Business hours"
      description="Leave a day blank if you don’t want it shown."
      dirty={dirty}
      state={state}
      onSave={() => save({ business_hours: hours })}
    >
      <div className="flex flex-col gap-2">
        {DAYS.map((day) => (
          <div key={day} className="flex items-center gap-3">
            <span className="text-body w-24 shrink-0 text-sm">{DAY_LABEL[day]}</span>
            <Input
              aria-label={`${DAY_LABEL[day]} hours`}
              placeholder="8:00 AM - 5:00 PM"
              value={hours[day] ?? ''}
              onChange={(e) => setHours((prev) => ({ ...prev, [day]: e.target.value }))}
            />
          </div>
        ))}
      </div>
    </Section>
  )
}

function ContactSection({ initial }: { initial: StorefrontEditModel }) {
  const [whatsapp, setWhatsapp] = React.useState(initial.contactWhatsapp)
  const [website, setWebsite] = React.useState(initial.websiteUrl)
  const [instagram, setInstagram] = React.useState(initial.instagramHandle)
  const { state, save } = usePatch()
  const dirty =
    whatsapp !== initial.contactWhatsapp ||
    website !== initial.websiteUrl ||
    instagram !== initial.instagramHandle

  return (
    <Section
      title="Contact & links"
      description="Shown once a customer reveals your details."
      dirty={dirty}
      state={state}
      onSave={() =>
        save({
          contact_whatsapp: whatsapp,
          website_url: website,
          instagram_handle: instagram,
        })
      }
    >
      <Input
        label="WhatsApp number"
        placeholder="868 000 0000"
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Website"
          placeholder="https://…"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
        <Input
          label="Instagram handle"
          placeholder="yourbusiness"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
        />
      </div>
    </Section>
  )
}

/** Exported for the empty-state preview line on the page. */
export function servicesSummary(services: StorefrontService[]): string {
  const priced = services.filter((s) => typeof s.price_ttd === 'number')
  if (priced.length === 0) return `${services.length} listed`
  const from = Math.min(...priced.map((s) => s.price_ttd as number))
  return `from ${formatTTD(from)}`
}
