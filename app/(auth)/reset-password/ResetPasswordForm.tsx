'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AUTH_COPY } from '@/lib/copy/auth'

const copy = AUTH_COPY.reset

const schema = z
  .object({
    password: z.string().min(8, copy.passwordError),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: copy.confirmError,
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof schema>

export function ResetPasswordForm() {
  const router = useRouter()

  // Supabase parses the recovery token from the URL fragment and emits
  // PASSWORD_RECOVERY asynchronously. Rendering the form before that arrives
  // would let someone submit into a session that does not exist yet, and the
  // update would fail for reasons the copy cannot explain.
  const [ready, setReady] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)

  React.useEffect(() => {
    const supabase = createClient()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true)
      }
    })

    // The event may have fired before this listener attached — a fast parse beats
    // the effect. Checking for an existing session covers that race, which
    // otherwise leaves the page stuck on "Processing…" for users on quick
    // connections.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setError(null)

    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password: values.password })

    if (updateError) {
      // Never surfaces updateError.message — Supabase's text here is
      // developer-facing and sometimes describes internal policy.
      setError(copy.error)
      return
    }

    setDone(true)
    router.push('/')
    router.refresh()
  }

  if (!ready) {
    return (
      <div className="flex flex-col gap-3 text-center" aria-busy="true">
        <p className="text-body text-sm">{copy.processing}</p>
        <Link
          href="/forgot-password"
          className="text-accent-ink text-xs underline-offset-4 hover:underline"
        >
          {copy.processingFallback}
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-display-md text-foreground">{copy.heading}</h1>
        <p className="text-muted text-sm">{copy.sub}</p>
      </header>

      {error && (
        <p
          role="alert"
          className="bg-destructive/10 text-destructive rounded-[--radius-control] p-3 text-sm"
        >
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Input
          label={copy.passwordLabel}
          placeholder={copy.passwordPlaceholder}
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          required
          {...register('password')}
        />
        <Input
          label={copy.confirmLabel}
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          required
          {...register('confirmPassword')}
        />

        <Button
          type="submit"
          fullWidth
          isLoading={isSubmitting || done}
          loadingLabel={copy.submitLoading}
        >
          {copy.submit}
        </Button>
      </form>
    </div>
  )
}
