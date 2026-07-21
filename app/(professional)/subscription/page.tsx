import type { Metadata } from 'next'
import { ToolStub } from '@/components/professional/ToolStub'

export const metadata: Metadata = { title: 'Subscription' }

export default function SubscriptionPage() {
  return <ToolStub title="Subscription" description="Your plan, billing and the Registered rate." />
}
