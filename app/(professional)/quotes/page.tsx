import type { Metadata } from 'next'
import { ToolStub } from '@/components/professional/ToolStub'

export const metadata: Metadata = { title: 'Quotes' }

export default function QuotesPage() {
  return (
    <ToolStub
      title="Quotes"
      description="Build and send estimates that convert straight into jobs."
    />
  )
}
