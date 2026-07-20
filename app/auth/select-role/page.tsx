import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SelectRoleForm } from './SelectRoleForm'
import { AUTH_COPY } from '@/lib/copy/auth'
import { loginRedirect } from '@/lib/routes'

export const metadata: Metadata = {
  title: AUTH_COPY.selectRole.title,
}

/**
 * /auth/select-role
 *
 * Deliberately outside the `(auth)` group and its card shell: this is not a
 * sign-in step but the first decision inside the product, and it needs the room.
 *
 * Guarded server-side. Reaching it without a session means something upstream
 * went wrong, and rendering role cards to an anonymous visitor would produce a
 * form that cannot submit.
 */
export default async function SelectRolePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(loginRedirect('/auth/select-role'))
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-6 py-16">
      <Suspense fallback={<div className="h-96" aria-busy="true" />}>
        <SelectRoleForm />
      </Suspense>
    </div>
  )
}
