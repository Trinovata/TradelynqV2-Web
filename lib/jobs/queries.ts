/**
 * Professional job reads (playbook S110). RLS-scoped (owns_professional_
 * profile via jobs_select_own); never cached — a job's status is live work.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Enums } from '@/types/database'

export type JobRow = {
  id: string
  customerName: string
  serviceDescription: string
  status: Enums<'job_status'>
  valueTtd: number | null
  createdAt: string
  completedAt: string | null
}

/** Which tab a status lands in. `invoiced` is a completed job that's been billed. */
export function jobTab(status: Enums<'job_status'>): 'active' | 'done' {
  return status === 'completed' || status === 'invoiced' ? 'done' : 'active'
}

export async function getProfessionalJobs(supabase: SupabaseClient<Database>): Promise<JobRow[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select(
      'id, customer_name, service_description, status, job_value_ttd, created_at, completed_at'
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (error || !data) return []
  return data.map((j) => ({
    id: j.id,
    customerName: j.customer_name,
    serviceDescription: j.service_description,
    status: j.status,
    valueTtd: j.job_value_ttd,
    createdAt: j.created_at,
    completedAt: j.completed_at,
  }))
}
