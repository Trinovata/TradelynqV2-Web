import type { Metadata } from 'next'
import { ToolStub } from '@/components/professional/ToolStub'

export const metadata: Metadata = { title: 'Settings' }

export default function SettingsPage() {
  return <ToolStub title="Settings" description="Account, notifications and preferences." />
}
