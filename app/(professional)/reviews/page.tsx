import type { Metadata } from 'next'
import { ToolStub } from '@/components/professional/ToolStub'

export const metadata: Metadata = { title: 'Reviews' }

export default function ReviewsPage() {
  return <ToolStub title="Reviews" description="What customers say, and your replies." />
}
