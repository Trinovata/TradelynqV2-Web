import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireCustomer } from '@/lib/access/api'
import { loginRedirect } from '@/lib/routes'
import { getCustomerEnquiryDetail } from '@/lib/enquiries/queries'
import { ReviewForm } from './ReviewForm'

export const metadata: Metadata = { title: 'Leave a review' }

/**
 * /home/enquiries/[id]/review (playbook S099). Eligibility is guarded here AND
 * at the API: only a completed, not-yet-reviewed enquiry reaches the form — an
 * ineligible id bounces back to the enquiry rather than showing a form that
 * would 409 on submit.
 */
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireCustomer()
  if (!access.ok) redirect(loginRedirect('/home/enquiries'))

  const { id } = await params
  const enquiry = await getCustomerEnquiryDetail(access.supabase, id)

  // Only a completed, unreviewed enquiry is reviewable — send anything else
  // back to the detail page, which shows the correct state.
  if (!enquiry || enquiry.status !== 'completed' || enquiry.hasReview) {
    redirect(`/home/enquiries/${id}`)
  }

  const proName = enquiry.professional?.business_name ?? 'the professional'

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
      <Link
        href={`/home/enquiries/${id}`}
        className="text-body hover:text-foreground inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to enquiry
      </Link>

      <h1 className="text-foreground font-display mt-4 text-2xl tracking-tight">Leave a review</h1>
      <p className="text-body mt-1 text-sm">
        Your honest feedback helps other customers — and helps {proName} get found.
      </p>

      <div className="mt-8">
        <ReviewForm enquiryId={id} professionalName={proName} />
      </div>
    </div>
  )
}
