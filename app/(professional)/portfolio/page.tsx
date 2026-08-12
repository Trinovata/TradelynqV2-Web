import type { Metadata } from 'next'
import { ToolStub } from '@/components/professional/ToolStub'

export const metadata: Metadata = { title: 'Portfolio' }

export default function PortfolioPage() {
  return <ToolStub title="Portfolio" description="Showcase your best work to win more enquiries." />
}
