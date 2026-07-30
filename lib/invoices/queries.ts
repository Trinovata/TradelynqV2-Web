/**
 * Professional invoice reads (playbook S111). RLS-scoped (owns_professional_
 * profile), never cached — invoice status is money and changes on payment.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Enums } from '@/types/database'

export type InvoiceListRow = {
  id: string
  invoiceNumber: string
  customerName: string
  status: Enums<'invoice_status'>
  totalTtd: number
  createdAt: string
  dueDate: string | null
  publicToken: string
}

export async function getProfessionalInvoices(
  supabase: SupabaseClient<Database>
): Promise<InvoiceListRow[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, customer_name, status, total_ttd, created_at, due_date, public_token'
    )
    .order('created_at', { ascending: false })
    .limit(200)

  if (error || !data) return []
  return data.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoice_number,
    customerName: i.customer_name,
    status: i.status,
    totalTtd: i.total_ttd,
    createdAt: i.created_at,
    dueDate: i.due_date,
    publicToken: i.public_token,
  }))
}

/** This professional's invoices created in the current calendar month. */
export async function getMonthlyInvoiceCount(supabase: SupabaseClient<Database>): Promise<number> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const { count } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', monthStart)
  return count ?? 0
}
