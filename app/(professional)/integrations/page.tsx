import type { Metadata } from 'next'
import { ToolStub } from '@/components/professional/ToolStub'

export const metadata: Metadata = { title: 'Integrations' }

export default function IntegrationsPage() {
  return <ToolStub title="Integrations" description="Webhooks and automation for Enterprise plans." />
}
