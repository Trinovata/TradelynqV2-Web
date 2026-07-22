import type { Metadata } from 'next'
import { ToolStub } from '@/components/professional/ToolStub'

export const metadata: Metadata = { title: 'Invoices' }

export default function InvoicesPage() {
  return (
    <ToolStub title="Invoices" description="Bill customers, send on WhatsApp, and track payment." />
  )
}
