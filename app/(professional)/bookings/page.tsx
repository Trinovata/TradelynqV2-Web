import type { Metadata } from 'next'
import { ToolStub } from '@/components/professional/ToolStub'

export const metadata: Metadata = { title: 'Bookings' }

export default function BookingsPage() {
  return <ToolStub title="Bookings" description="Appointments, reminders and your availability." />
}
