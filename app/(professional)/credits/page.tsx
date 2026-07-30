import type { Metadata } from 'next'
import { ToolStub } from '@/components/professional/ToolStub'

export const metadata: Metadata = { title: 'Credits' }

export default function CreditsPage() {
  return <ToolStub title="Credits" description="Your tool-credit balance, history and bundles." />
}
