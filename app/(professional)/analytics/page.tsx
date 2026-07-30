import type { Metadata } from 'next'
import { ToolStub } from '@/components/professional/ToolStub'

export const metadata: Metadata = { title: 'Analytics' }

export default function AnalyticsPage() {
  return <ToolStub title="Analytics" description="Views, enquiry sources and response time." />
}
