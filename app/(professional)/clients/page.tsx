import type { Metadata } from 'next'
import { ToolStub } from '@/components/professional/ToolStub'

export const metadata: Metadata = { title: 'Clients' }

export default function ClientsPage() {
  return <ToolStub title="Clients" description="Your CRM — contacts, job history and lifetime value." />
}
