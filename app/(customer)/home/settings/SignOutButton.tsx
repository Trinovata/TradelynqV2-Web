'use client'

/**
 * Sign out (playbook S103). Client-side Supabase sign-out clears the session
 * cookie and the auth listener; a hard navigation to the landing guarantees no
 * stale authed UI lingers. No confirm dialog — signing out is reversible by
 * signing back in.
 */
import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

export function SignOutButton() {
  const [busy, setBusy] = React.useState(false)

  const signOut = async () => {
    setBusy(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    // Hard navigation, not router.push — drop every cached authed view.
    window.location.href = '/'
  }

  return (
    <Button variant="secondary" onClick={signOut} isLoading={busy} loadingLabel="Signing out…">
      Sign out
    </Button>
  )
}
