/**
 * Shared document chrome (playbook S093 + the S074 remainder): letterhead,
 * line-item table, totals, and the compliance footer used by QuoteDocument
 * and InvoiceDocument alike. ONE component set — a token page, a portal view,
 * and a future PDF all render the same markup, so a document can never look
 * different in two places (§3.13's own rule).
 *
 * Branding follows lib/branding/documents.ts: full TradeLynq letterhead for
 * Presence/Growth, co-brand for Studio/Pro, white-label for Enterprise — the
 * compliance footer is unconditional (the D-era rule).
 */
import { Avatar } from '@/components/ui/Avatar'
import { formatTTD } from '@/lib/utils/format'
import type { DocumentBranding } from '@/lib/branding/documents'
import type { DocumentLineItem } from '@/lib/documents/tokens'

export function DocumentLetterhead({
  professionalName,
  avatarUrl,
  branding,
}: {
  professionalName: string
  avatarUrl: string | null
  branding: DocumentBranding
}) {
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {branding.professionalLogo && (
          <Avatar src={avatarUrl} alt={professionalName} name={professionalName} size={40} />
        )}
        <span className="text-foreground text-lg font-semibold tracking-tight">
          {professionalName}
        </span>
      </div>
      {branding.letterhead !== 'white_label' && (
        <span
          className={
            branding.letterhead === 'full'
              ? 'text-foreground text-base font-semibold tracking-tight'
              : 'text-muted text-sm font-medium'
          }
        >
          Trade<span className="text-brand-cyan">Lynq</span>
        </span>
      )}
    </header>
  )
}

export function DocumentLineItems({
  items,
  subtotalTtd,
  vatPercent,
  vatAmountTtd,
  totalTtd,
  totalsLabel,
}: {
  items: DocumentLineItem[]
  subtotalTtd: number
  vatPercent: number
  vatAmountTtd: number
  totalTtd: number
  /** "Total" for quotes, "Amount due" for invoices (deck §14). */
  totalsLabel: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Line items</caption>
        <thead>
          <tr className="text-muted border-border border-b text-left text-xs">
            <th scope="col" className="py-2 pr-4 font-normal">
              Description
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-normal">
              Qty
            </th>
            <th scope="col" className="py-2 pr-4 text-right font-normal">
              Unit
            </th>
            <th scope="col" className="py-2 text-right font-normal">
              Amount
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {items.map((item, index) => (
            <tr key={index}>
              <td className="text-foreground py-2.5 pr-4">{item.description}</td>
              <td className="text-body py-2.5 pr-4 text-right font-mono tabular-nums">
                {item.quantity}
              </td>
              <td className="text-body py-2.5 pr-4 text-right font-mono tabular-nums">
                {formatTTD(item.unit_price)}
              </td>
              <td className="text-foreground py-2.5 text-right font-mono tabular-nums">
                {formatTTD(item.amount)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-border border-t">
            <td colSpan={3} className="text-body py-2 pr-4 text-right text-xs">
              Subtotal
            </td>
            <td className="text-body py-2 text-right font-mono text-xs tabular-nums">
              {formatTTD(subtotalTtd)}
            </td>
          </tr>
          {vatAmountTtd > 0 && (
            <tr>
              <td colSpan={3} className="text-body py-1 pr-4 text-right text-xs">
                VAT ({vatPercent}%)
              </td>
              <td className="text-body py-1 text-right font-mono text-xs tabular-nums">
                {formatTTD(vatAmountTtd)}
              </td>
            </tr>
          )}
          <tr>
            <td colSpan={3} className="text-foreground py-2 pr-4 text-right font-medium">
              {totalsLabel}
            </td>
            <td className="text-foreground py-2 text-right font-mono text-base font-semibold tabular-nums">
              {formatTTD(totalTtd)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function DocumentFooter({ branding }: { branding: DocumentBranding }) {
  return (
    <footer className="border-border mt-8 border-t pt-4">
      <p className="text-muted text-xs">Sent via TradeLynq</p>
      <p className="text-muted mt-0.5 text-xs">{branding.complianceFooter}</p>
    </footer>
  )
}
