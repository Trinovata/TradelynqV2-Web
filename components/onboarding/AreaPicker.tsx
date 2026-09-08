'use client'

/**
 * Service-area multi-select, grouped by region (playbook S107,
 * copy `copy-professional.md §4.1`).
 *
 * Region grouping is not decoration. A professional in Chaguanas serves Central
 * and travels East; asking them to find eleven towns in a flat alphabetical list
 * of ninety is how you end up with listings that name one area. The
 * whole-region toggle is the fastest honest answer for most professionals.
 *
 * Areas are stored as the display strings themselves rather than ids, matching
 * `professional_profiles.service_areas TEXT[]` and the search filters that read
 * it — a lookup table here would be a third representation of the same list.
 */
import * as React from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { TRINIDAD_AREA_GROUPS } from '@/lib/constants/areas'
import { cn } from '@/lib/utils/cn'

export function AreaPicker({
  value,
  onChange,
  error,
}: {
  value: string[]
  onChange: (areas: string[]) => void
  error?: string
}) {
  const selected = React.useMemo(() => new Set(value), [value])
  // First region open, the rest collapsed: ninety checkboxes at once is a wall,
  // and the picker has to be usable one-handed at 375px.
  const [openRegion, setOpenRegion] = React.useState<string | null>(
    TRINIDAD_AREA_GROUPS[0]?.region ?? null
  )
  const errorId = React.useId()

  function toggleArea(area: string) {
    onChange(selected.has(area) ? value.filter((item) => item !== area) : [...value, area])
  }

  function toggleRegion(areas: string[]) {
    const allSelected = areas.every((area) => selected.has(area))
    onChange(
      allSelected
        ? value.filter((item) => !areas.includes(item))
        : // Deduplicated: a region toggle must not add an area the professional
          // already picked individually.
          Array.from(new Set([...value, ...areas]))
    )
  }

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-foreground text-sm font-medium">
        Where do you work? <span className="text-destructive">*</span>
      </legend>
      <p className="text-muted text-xs">Select every area you’ll travel to.</p>

      {value.length > 0 && (
        <p className="text-muted mt-1 text-xs">
          <span className="font-mono tabular-nums">{value.length}</span>{' '}
          {value.length === 1 ? 'area' : 'areas'} selected
        </p>
      )}

      <div
        className={cn(
          'border-border divide-border mt-1 divide-y overflow-hidden rounded-[--radius-control] border',
          error && 'border-destructive'
        )}
        aria-describedby={error ? errorId : undefined}
      >
        {TRINIDAD_AREA_GROUPS.map((group) => {
          const chosen = group.areas.filter((area) => selected.has(area)).length
          const isOpen = openRegion === group.region

          return (
            <div key={group.region}>
              <div className="bg-card flex items-center">
                <button
                  type="button"
                  onClick={() => setOpenRegion(isOpen ? null : group.region)}
                  aria-expanded={isOpen}
                  className="hover:bg-card-subtle focus-visible:outline-ring flex flex-1 items-center gap-2 px-3 py-2.5 text-left text-sm focus-visible:outline-2 focus-visible:-outline-offset-2"
                >
                  <ChevronDown
                    className={cn(
                      'text-muted size-4 transition-transform',
                      !isOpen && '-rotate-90'
                    )}
                    aria-hidden="true"
                  />
                  <span className="text-foreground">{group.region}</span>
                  {chosen > 0 && (
                    <span className="text-accent-ink font-mono text-xs tabular-nums">{chosen}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => toggleRegion(group.areas)}
                  className="text-muted hover:text-accent-ink px-3 py-2.5 text-xs underline-offset-4 hover:underline"
                >
                  {chosen === group.areas.length ? 'Clear' : 'All'}
                </button>
              </div>

              {isOpen && (
                <ul className="bg-card-subtle grid grid-cols-2 gap-1 p-2 sm:grid-cols-3">
                  {group.areas.map((area) => {
                    const isSelected = selected.has(area)
                    return (
                      <li key={area}>
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => toggleArea(area)}
                          className={cn(
                            'flex w-full items-center gap-1.5 rounded-[--radius-control] px-2.5 py-2 text-left text-sm',
                            'focus-visible:outline-ring focus-visible:outline-2 focus-visible:-outline-offset-2',
                            isSelected
                              ? 'bg-accent-soft text-accent-ink'
                              : 'text-body hover:bg-card'
                          )}
                        >
                          <Check
                            className={cn('size-3.5 shrink-0', !isSelected && 'invisible')}
                            aria-hidden="true"
                          />
                          <span className="truncate">{area}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </fieldset>
  )
}
