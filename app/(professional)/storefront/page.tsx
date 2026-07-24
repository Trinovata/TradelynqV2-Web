import type { Metadata } from 'next'
import { ToolStub } from '@/components/professional/ToolStub'

export const metadata: Metadata = { title: 'Storefront' }

export default function StorefrontPage() {
  return <ToolStub title="Storefront" description="Your public profile, portfolio and offerings." />
}
