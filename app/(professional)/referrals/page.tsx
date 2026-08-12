import type { Metadata } from 'next'
import { ToolStub } from '@/components/professional/ToolStub'

export const metadata: Metadata = { title: 'Referrals' }

export default function ReferralsPage() {
  return (
    <ToolStub title="Referrals" description="Invite other professionals and earn tool credits." />
  )
}
