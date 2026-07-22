import type { Metadata } from 'next'
import { ToolStub } from '@/components/professional/ToolStub'

export const metadata: Metadata = { title: 'Readiness' }

export default function ReadinessPage() {
  return (
    <ToolStub
      title="Readiness"
      description="Complete your profile and earn your verified badges."
    />
  )
}
