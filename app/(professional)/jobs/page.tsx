import type { Metadata } from 'next'
import { ToolStub } from '@/components/professional/ToolStub'

export const metadata: Metadata = { title: 'Jobs' }

export default function JobsPage() {
  return <ToolStub title="Jobs" description="Track every job from accepted through to paid." />
}
