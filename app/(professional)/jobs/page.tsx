import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Hammer } from 'lucide-react'
import { requireProfessional } from '@/lib/access/api'
import { loginRedirect } from '@/lib/routes'
import { getProfessionalJobs, jobTab } from '@/lib/jobs/queries'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/States'
import { BlurFade } from '@/components/ui/blur-fade'
import { formatTTD, formatDateShort } from '@/lib/utils/format'
import { AddJobButton, JobRowActions } from './JobActions'

export const metadata: Metadata = { title: 'Jobs' }

// Live work status, per-professional — never cache.
export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<string, string> = {
  enquiry: 'New',
  accepted: 'Accepted',
  in_progress: 'In progress',
  completed: 'Completed',
  invoiced: 'Invoiced',
}

/** Job statuses onto the Badge's canonical status law (Badge has no 'enquiry'
 *  or 'invoiced' key — map to the nearest colour meaning). */
const BADGE_STATUS: Record<string, 'pending' | 'accepted' | 'in_progress' | 'completed'> = {
  enquiry: 'pending',
  accepted: 'accepted',
  in_progress: 'in_progress',
  completed: 'completed',
  invoiced: 'completed',
}

export default async function JobsPage() {
  const access = await requireProfessional()
  if (!access.ok) redirect(loginRedirect('/jobs'))

  const jobs = await getProfessionalJobs(access.supabase)
  const active = jobs.filter((j) => jobTab(j.status) === 'active')
  const done = jobs.filter((j) => jobTab(j.status) === 'done')

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <BlurFade delay={0} className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-foreground font-display text-2xl tracking-tight">Jobs</h1>
          <p className="text-muted mt-1 text-sm">
            Track the work you have on — log a job, start it, and mark it done.
          </p>
        </div>
        <AddJobButton />
      </BlurFade>

      {jobs.length === 0 ? (
        <BlurFade delay={0.08}>
          <EmptyState
            icon={Hammer}
            heading="No jobs yet"
            body="Log a job to track work from your WhatsApp leads and walk-ins — or accept an enquiry to start one."
          />
        </BlurFade>
      ) : (
        <div className="flex flex-col gap-8">
          {active.length > 0 && (
            <BlurFade delay={0.08}>
              <JobGroup heading="In progress" jobs={active} />
            </BlurFade>
          )}
          {done.length > 0 && (
            <BlurFade delay={0.14}>
              <JobGroup heading="Completed" jobs={done} muted />
            </BlurFade>
          )}
        </div>
      )}
    </div>
  )
}

function JobGroup({
  heading,
  jobs,
  muted,
}: {
  heading: string
  jobs: Awaited<ReturnType<typeof getProfessionalJobs>>
  muted?: boolean
}) {
  return (
    <section>
      <h2 className="text-muted mb-3 text-xs font-medium tracking-[0.12em] uppercase">{heading}</h2>
      <ul className="flex flex-col gap-2">
        {jobs.map((job) => (
          <li
            key={job.id}
            className={`border-border bg-card flex items-center justify-between gap-4 rounded-[--radius-card] border p-4 ${muted ? 'opacity-80' : ''}`}
          >
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm font-medium">{job.customerName}</p>
              <p className="text-muted mt-0.5 line-clamp-1 text-xs">{job.serviceDescription}</p>
              <p className="text-muted mt-1 text-xs">
                {formatDateShort(job.createdAt)}
                {typeof job.valueTtd === 'number' && (
                  <>
                    {' · '}
                    <span className="text-body font-mono tabular-nums">
                      {formatTTD(job.valueTtd)}
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Badge status={BADGE_STATUS[job.status] ?? 'pending'}>
                {STATUS_LABEL[job.status] ?? job.status}
              </Badge>
              <JobRowActions id={job.id} status={job.status} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
