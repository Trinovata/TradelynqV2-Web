'use client'

import * as React from 'react'
import * as RadixSelect from '@radix-ui/react-select'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { motion } from '@/lib/motion'

/**
 * Select / Combobox (playbook S063, contract v2/details/components-primitives.md §4).
 *
 * One public component, two substrates — and the reason is worth stating because
 * the alternative looks tidier and is worse:
 *
 *   - **Plain select → Radix Select.** Real listbox semantics, native
 *     type-to-jump, and the mobile behaviour people already know.
 *   - **Searchable → Radix Popover + the ARIA 1.2 combobox pattern.** Radix
 *     Select owns every printable keystroke for its own typeahead, so a filter
 *     field living inside it fights the component for each character. Rather
 *     than defeat Radix's key handling with `stopPropagation` (which silently
 *     breaks its typeahead, Home/End, and roving focus), the searchable variant
 *     uses a Popover and drives the list with `aria-activedescendant` —
 *     DOM focus stays in the text field, exactly where a person is typing.
 *
 * `searchable` is left undefined by default and resolves to true at eight or
 * more options. Below that a filter field is furniture; above it, scanning is
 * slower than typing.
 *
 * Grouped options keep the caller's order rather than being sorted — the order
 * of service areas by region is information, and alphabetising discards it.
 */

/** Above this many options, a filter field earns its place. */
const SEARCHABLE_THRESHOLD = 8

export type SelectOption<T extends string> = {
  value: T
  label: string
  group?: string
  disabled?: boolean
}

export type SelectProps<T extends string> = {
  options: SelectOption<T>[]
  value: T | null
  onChange: (value: T) => void
  placeholder?: string
  error?: string
  /** Defaults to true at ≥ 8 options. Pass explicitly to override either way. */
  searchable?: boolean
  /** Shows a clear affordance while a value is set. Requires `onClear`. */
  clearable?: boolean
  onClear?: () => void
  label?: string
  /** Shown under the field. Suppressed while an error is displayed. */
  hint?: string
  required?: boolean
  disabled?: boolean
  /** Emits a hidden input so the value posts with an uncontrolled form. */
  name?: string
  className?: string
}

/**
 * Mirrors `fieldClasses` in Input.tsx.
 *
 * Deliberately duplicated rather than imported: that helper is private to
 * Input, and a Select trigger that drifted from an Input would be visible on
 * every form on the platform. If a third caller appears, promote it to a shared
 * module — two is not yet a pattern.
 */
const triggerClasses = (hasError: boolean) =>
  cn(
    'flex h-10 w-full items-center justify-between gap-2',
    'rounded-[--radius-control] border bg-card-subtle px-3 text-left text-sm text-body',
    // Only border and box-shadow transition — never `all`.
    'transition-[border-color,box-shadow] duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'data-[placeholder]:text-muted',
    hasError ? 'border-destructive' : 'border-border focus:border-accent'
  )

/** The dropdown surface: card elevation, M4 reveal. */
const menuClasses = cn(
  'z-50 min-w-[var(--radix-popper-anchor-width)] overflow-hidden',
  'rounded-[--radius-card] border border-border bg-card shadow-lg',
  motion('fadeSlideIn'),
  'data-[state=closed]:opacity-0 data-[state=open]:opacity-100'
)

/** A single row. 44px tall so the touch target needs no separate padding. */
const optionClasses = (selected: boolean) =>
  cn(
    'relative flex min-h-11 w-full cursor-pointer select-none items-center justify-between gap-2',
    'rounded-[--radius-control] px-3 py-2 text-sm text-body outline-none',
    'data-[highlighted]:bg-card-subtle',
    'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
    selected && 'bg-accent-soft text-foreground'
  )

const groupLabelClasses = 'px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted'

/**
 * Buckets consecutive options by their `group`, preserving caller order.
 * Options with no group form their own ungrouped run.
 */
function groupOptions<T extends string>(options: SelectOption<T>[]) {
  const groups: { name: string | undefined; options: SelectOption<T>[] }[] = []

  for (const option of options) {
    const last = groups[groups.length - 1]
    if (last && last.name === option.group) last.options.push(option)
    else groups.push({ name: option.group, options: [option] })
  }

  return groups
}

type FieldShellProps = {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: (ids: { controlId: string; describedBy: string | undefined }) => React.ReactNode
}

function FieldShell({ label, hint, error, required, className, children }: FieldShellProps) {
  const reactId = React.useId()
  const controlId = `select-${reactId}`
  const hintId = `${controlId}-hint`
  const errorId = `${controlId}-error`

  // Error takes precedence over the hint: two messages compete for attention at
  // the exact moment one clear instruction is needed.
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={controlId} className="text-foreground text-sm font-medium">
          {label}
          {required && (
            <span className="text-destructive" aria-hidden="true">
              {' '}
              *
            </span>
          )}
          {required && <span className="sr-only"> (required)</span>}
        </label>
      )}

      {children({ controlId, describedBy })}

      {error ? (
        // role="alert" so it is announced when it appears, not only on focus.
        <p id={errorId} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-muted text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** The ✕ that empties the field. Sits outside the trigger — buttons cannot nest. */
function ClearButton({ onClear, label }: { onClear: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={label}
      className={cn(
        'absolute top-1/2 right-8 flex size-11 -translate-y-1/2 items-center justify-center',
        'text-muted hover:text-foreground',
        'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2'
      )}
    >
      <X className="size-4" aria-hidden="true" />
    </button>
  )
}

export function Select<T extends string>({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  error,
  searchable,
  clearable,
  onClear,
  label,
  hint,
  required,
  disabled,
  name,
  className,
}: SelectProps<T>) {
  const isSearchable = searchable ?? options.length >= SEARCHABLE_THRESHOLD
  const showClear = Boolean(clearable && onClear && value !== null && !disabled)

  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={className}>
      {({ controlId, describedBy }) =>
        isSearchable ? (
          <SearchableSelect
            controlId={controlId}
            describedBy={describedBy}
            options={options}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            hasError={Boolean(error)}
            required={required}
            disabled={disabled}
            name={name}
            showClear={showClear}
            onClear={onClear}
          />
        ) : (
          <PlainSelect
            controlId={controlId}
            describedBy={describedBy}
            options={options}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            hasError={Boolean(error)}
            required={required}
            disabled={disabled}
            name={name}
            showClear={showClear}
            onClear={onClear}
          />
        )
      }
    </FieldShell>
  )
}

type VariantProps<T extends string> = {
  controlId: string
  describedBy: string | undefined
  options: SelectOption<T>[]
  value: T | null
  onChange: (value: T) => void
  placeholder: string
  hasError: boolean
  required?: boolean
  disabled?: boolean
  name?: string
  showClear: boolean
  onClear?: () => void
}

/** Radix Select. Full listbox semantics and native type-to-jump, for free. */
function PlainSelect<T extends string>({
  controlId,
  describedBy,
  options,
  value,
  onChange,
  placeholder,
  hasError,
  required,
  disabled,
  name,
  showClear,
  onClear,
}: VariantProps<T>) {
  const groups = groupOptions(options)

  return (
    <div className="relative">
      <RadixSelect.Root
        // Empty string matches no item, so Radix shows the placeholder while
        // the component stays controlled — `undefined` would hand control back.
        value={value ?? ''}
        onValueChange={(next) => onChange(next as T)}
        disabled={disabled}
        name={name}
        required={required}
      >
        <RadixSelect.Trigger
          id={controlId}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          className={cn(triggerClasses(hasError), showClear && 'pr-16')}
        >
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon asChild>
            <ChevronDown className="text-muted size-4 shrink-0" aria-hidden="true" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content position="popper" sideOffset={4} className={menuClasses}>
            <RadixSelect.Viewport className="max-h-72 p-1">
              {groups.map((group, groupIndex) =>
                group.name === undefined ? (
                  <React.Fragment key={`ungrouped-${groupIndex}`}>
                    {group.options.map((option) => (
                      <PlainOption
                        key={option.value}
                        option={option}
                        selected={option.value === value}
                      />
                    ))}
                  </React.Fragment>
                ) : (
                  // Radix renders role="group" with the label as its accessible name.
                  <RadixSelect.Group key={group.name}>
                    <RadixSelect.Label className={groupLabelClasses}>
                      {group.name}
                    </RadixSelect.Label>
                    {group.options.map((option) => (
                      <PlainOption
                        key={option.value}
                        option={option}
                        selected={option.value === value}
                      />
                    ))}
                  </RadixSelect.Group>
                )
              )}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>

      {showClear && onClear && <ClearButton onClear={onClear} label={`Clear ${placeholder}`} />}
    </div>
  )
}

function PlainOption<T extends string>({
  option,
  selected,
}: {
  option: SelectOption<T>
  selected: boolean
}) {
  return (
    <RadixSelect.Item
      value={option.value}
      disabled={option.disabled}
      className={optionClasses(selected)}
    >
      <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator asChild>
        <Check className="text-accent-ink size-4 shrink-0" aria-hidden="true" />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  )
}

/**
 * Popover + ARIA 1.2 combobox. DOM focus never leaves the filter field; the
 * highlighted row is announced through `aria-activedescendant`, which is the
 * only way arrow keys and typing can coexist in one control.
 */
function SearchableSelect<T extends string>({
  controlId,
  describedBy,
  options,
  value,
  onChange,
  placeholder,
  hasError,
  required,
  disabled,
  name,
  showClear,
  onClear,
}: VariantProps<T>) {
  const reactId = React.useId()
  const listId = `combobox-list-${reactId}`

  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const listRef = React.useRef<HTMLDivElement>(null)

  const selectedOption = options.find((option) => option.value === value) ?? null

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    return options.filter((option) => option.label.toLowerCase().includes(needle))
  }, [options, query])

  const groups = groupOptions(filtered)
  const optionId = (index: number) => `${listId}-option-${index}`

  // Keeps the highlighted row visible as the arrow keys walk past the fold.
  React.useEffect(() => {
    if (!open) return
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  const firstEnabledIndex = (from: number, delta: number) => {
    if (filtered.length === 0) return -1
    let index = from
    for (let step = 0; step < filtered.length; step += 1) {
      index = (index + delta + filtered.length) % filtered.length
      if (!filtered[index]?.disabled) return index
    }
    return -1
  }

  const openMenu = () => {
    setQuery('')
    const selectedIndex = options.findIndex((option) => option.value === value)
    setActiveIndex(
      selectedIndex >= 0 && !options[selectedIndex]?.disabled
        ? selectedIndex
        : firstEnabledIndex(-1, 1)
    )
    setOpen(true)
  }

  const commit = (index: number) => {
    const option = filtered[index]
    if (!option || option.disabled) return
    onChange(option.value)
    setOpen(false)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex(firstEnabledIndex(activeIndex, 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex(firstEnabledIndex(activeIndex, -1))
        break
      case 'Home':
        event.preventDefault()
        setActiveIndex(firstEnabledIndex(-1, 1))
        break
      case 'End':
        event.preventDefault()
        setActiveIndex(firstEnabledIndex(0, -1))
        break
      case 'Enter':
        event.preventDefault()
        commit(activeIndex)
        break
      case 'Tab':
        // Tab commits nothing and closes — an accidental selection on the way
        // out of a form is far more annoying than re-opening the menu.
        setOpen(false)
        break
      default:
        break
    }
  }

  // Flat index into `filtered`, rebuilt per group so `aria-activedescendant`
  // and the arrow-key cursor address the same rows.
  let flatIndex = -1

  return (
    <Popover.Root open={open} onOpenChange={(next) => (next ? openMenu() : setOpen(false))}>
      <div className="relative">
        <Popover.Trigger asChild>
          <button
            type="button"
            id={controlId}
            disabled={disabled}
            // The collapsed combobox itself. `role="button"` would be honest
            // about the element but wrong about the widget — and a plain button
            // supports neither aria-invalid nor aria-required, so the error and
            // required states would go unannounced.
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listId}
            aria-invalid={hasError || undefined}
            aria-describedby={describedBy}
            aria-required={required || undefined}
            className={cn(
              triggerClasses(hasError),
              showClear && 'pr-16',
              !selectedOption && 'text-muted'
            )}
          >
            <span className="truncate">{selectedOption?.label ?? placeholder}</span>
            <ChevronDown className="text-muted size-4 shrink-0" aria-hidden="true" />
          </button>
        </Popover.Trigger>

        {showClear && onClear && <ClearButton onClear={onClear} label={`Clear ${placeholder}`} />}
      </div>

      {/* Posts with an uncontrolled form the way a native select would. */}
      {name && <input type="hidden" name={name} value={value ?? ''} />}

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className={cn(menuClasses, 'w-[var(--radix-popover-trigger-width)]')}
          // Focus belongs in the filter field, not on the popover shell.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            ;(event.currentTarget as HTMLElement)
              .querySelector<HTMLInputElement>('input[type="text"]')
              ?.focus()
          }}
        >
          <div className="border-border flex items-center gap-2 border-b px-3">
            <Search className="text-muted size-4 shrink-0" aria-hidden="true" />
            <input
              // A plain textbox, deliberately: the trigger above is the
              // combobox. Two combobox roles in one widget is one too many.
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search"
              aria-label="Filter options"
              aria-autocomplete="list"
              aria-controls={listId}
              aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
              className="text-body placeholder:text-muted h-10 w-full bg-transparent text-sm outline-none"
            />
          </div>

          <div ref={listRef} id={listId} role="listbox" className="max-h-72 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="text-muted px-3 py-6 text-center text-sm">
                No matches. Try a shorter search.
              </p>
            ) : (
              groups.map((group, groupIndex) => {
                const groupLabelId = `${listId}-group-${groupIndex}`

                return (
                  <div
                    key={group.name ?? `ungrouped-${groupIndex}`}
                    role="group"
                    aria-labelledby={group.name ? groupLabelId : undefined}
                  >
                    {group.name && (
                      <div id={groupLabelId} className={groupLabelClasses}>
                        {group.name}
                      </div>
                    )}
                    {group.options.map((option) => {
                      flatIndex += 1
                      const index = flatIndex
                      const isActive = index === activeIndex
                      const isSelected = option.value === value

                      return (
                        <div
                          key={option.value}
                          id={optionId(index)}
                          role="option"
                          aria-selected={isSelected}
                          aria-disabled={option.disabled || undefined}
                          data-active={isActive || undefined}
                          data-highlighted={isActive || undefined}
                          data-disabled={option.disabled || undefined}
                          onPointerDown={(event) => event.preventDefault()}
                          onClick={() => commit(index)}
                          onPointerMove={() => !option.disabled && setActiveIndex(index)}
                          className={optionClasses(isSelected)}
                        >
                          <span className="truncate">{option.label}</span>
                          {isSelected && (
                            <Check className="text-accent-ink size-4 shrink-0" aria-hidden="true" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
