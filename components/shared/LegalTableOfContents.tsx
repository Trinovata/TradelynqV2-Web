'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, List } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface TocItem {
  id: string
  text: string
}

export function LegalTableOfContents() {
  const [items, setItems] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [expanded, setExpanded] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Scan for h3 elements and set up IntersectionObserver
  useEffect(() => {
    const headings = Array.from(document.querySelectorAll('h3[id]'))
    const tocItems: TocItem[] = headings.map((h) => ({
      id: h.id,
      text: h.textContent ?? '',
    }))
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync of React to the page's server-rendered headings, which exist only after mount
    setItems(tocItems)

    // Observe each heading for scroll tracking
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the first visible heading
        const visible = entries.find((e) => e.isIntersecting)
        if (visible) {
          setActiveId(visible.target.id)
        }
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    )

    headings.forEach((h) => observerRef.current?.observe(h))

    return () => {
      observerRef.current?.disconnect()
    }
  }, [])

  if (items.length === 0) return null

  function handleClick(id: string) {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveId(id)
      setExpanded(false) // Collapse mobile TOC after click
    }
  }

  return (
    <>
      {/* Mobile: collapsible top TOC */}
      <div className="mb-6 lg:hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="bg-card-subtle border-border text-foreground flex w-full items-center justify-between gap-2 rounded-lg border px-4 py-3 text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            <List className="text-brand-cyan h-4 w-4" />
            Table of contents
          </span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {expanded && (
          <nav className="bg-card border-border mt-2 max-h-[50vh] overflow-y-auto rounded-lg border py-2">
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleClick(item.id)}
                className={cn(
                  'w-full px-4 py-2 text-left text-xs transition-colors',
                  activeId === item.id
                    ? 'text-brand-cyan bg-accent-soft font-semibold'
                    : 'text-muted hover:text-brand-cyan hover:bg-card-subtle'
                )}
              >
                {item.text}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Desktop: sticky sidebar TOC */}
      <nav className="sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto lg:block">
        <p className="text-muted mb-3 flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase">
          <List className="h-3.5 w-3.5" />
          Contents
        </p>
        <div className="border-border flex flex-col gap-0.5 border-l">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleClick(item.id)}
              className={cn(
                '-ml-px border-l-2 py-1.5 pl-3 text-left text-xs leading-snug transition-colors',
                activeId === item.id
                  ? 'border-brand-cyan text-brand-cyan font-semibold'
                  : 'text-muted hover:text-brand-cyan hover:border-border border-transparent'
              )}
            >
              {item.text}
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}
