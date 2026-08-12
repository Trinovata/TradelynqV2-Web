import type { Metadata } from 'next'
import { ToolStub } from '@/components/professional/ToolStub'

export const metadata: Metadata = { title: 'Offerings' }

export default function OfferingsPage() {
  return <ToolStub title="Offerings" description="The services you offer and what they cost." />
}
