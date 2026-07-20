'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AUTH_COPY, authErrorMessage } from '@/lib/copy/auth'
import { safeNextPath } from '@/lib/routes'

const copy = AUTH_COPY.login

const schema = z.object({
  email: z.string().email(copy.emailError),
  password: z.string().min(1, copy.passwordError),
})

type FormValues = z.infer<typeof schema>

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [formError, setFormError] = React.useState<string | null>(null)
  const [unconfirmedEmail, setUnconfirmedEmail] = React.useState<string | null>(null)
  const [resendState, setResendState] = React.useState<'idle' | 'sending' | 'sent'>('idle')
  const [googleLoading, setGoogleLoading] = React.useState(false)

  const nextParam = searchParams.get('next')
  const isSwitching = searchParams.get('switch') === '1'

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setFormError(null)
    setUnconfirmedEmail(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })

    if (error) {
      // Supabase reports an unconfirmed email as an error, but it is not a
      // failure the user can fix by retrying — it needs a different affordance.
      if (error.code === 'email_not_confirmed') {
        setUnconfirmedEmail(values.email)
        return
      }
      setFormError(authErrorMessage(error.code, 'login'))
      return
    }

    // Validated before use: an unchecked `next` is an open redirect, and this is
    // the page where the user has just been asked to trust us with a password.
    router.push(safeNextPath(nextParam, '/'))
    // Ensures Server Components re-read the now-authenticated session rather
    // than serving a cached signed-out render.
    router.refresh()
  }

  async function onGoogle() {
    setGoogleLoading(true)
    setFormError(null)

    const supabase = createClient()
    const callback = new URL('/auth/callback', window.location.origin)
    if (nextParam) callback.searchParams.set('next', safeNextPath(nextParam, '/'))

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callback.toString() },
    })

    if (error) {
      setFormError(copy.googleError)
      setGoogleLoading(false)
    }
    // On success the browser navigates away; leaving the button in its loading
    // state is correct, since resetting it would flash an interactive control
    // during the redirect.
  }

  async function onResend() {
    if (!unconfirmedEmail) return
    setResendState('sending')

    const supabase = createClient()
    await supabase.auth.resend({ type: 'signup', email: unconfirmedEmail })

    // Deliberately not branching on the result: whether or not the address
    // exists, the answer shown is the same. Anything else turns this into an
    // account-enumeration oracle that needs no password at all.
    setResendState('sent')
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-display-md text-foreground">{copy.heading}</h1>
        <p className="text-muted text-sm">{isSwitching ? copy.subSwitching : copy.sub}</p>
        {nextParam && <p className="text-muted text-xs">{copy.nextPathNote}</p>}
      </header>

      {unconfirmedEmail && (
        <div className="border-info/30 bg-info/10 flex flex-col gap-2 rounded-[--radius-control] border p-3">
          <p className="text-foreground text-sm font-medium">{copy.unconfirmedHeading}</p>
          <p className="text-body text-xs">{copy.unconfirmedBody(unconfirmedEmail)}</p>
          {resendState === 'sent' ? (
            <p className="text-success text-xs">{copy.resendDone}</p>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={onResend}
              isLoading={resendState === 'sending'}
              loadingLabel={copy.resendLoading}
            >
              {copy.resend}
            </Button>
          )}
        </div>
      )}

      {formError && (
        <p
          role="alert"
          className="bg-destructive/10 text-destructive rounded-[--radius-control] p-3 text-sm"
        >
          {formError}
        </p>
      )}

      <Button
        variant="secondary"
        fullWidth
        onClick={onGoogle}
        isLoading={googleLoading}
        loadingLabel={copy.googleLoading}
      >
        {copy.google}
      </Button>

      <div className="flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted text-xs">{copy.divider}</span>
        <span className="bg-border h-px flex-1" />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
        <Input
          label={copy.emailLabel}
          placeholder={copy.emailPlaceholder}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          required
          {...register('email')}
        />

        <div className="flex flex-col gap-1.5">
          <Input
            label={copy.passwordLabel}
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            required
            {...register('password')}
          />
          <Link
            href="/forgot-password"
            className="text-accent-ink self-end text-xs underline-offset-4 hover:underline"
          >
            {copy.forgot}
          </Link>
        </div>

        <Button type="submit" fullWidth isLoading={isSubmitting} loadingLabel={copy.submitLoading}>
          {copy.submit}
        </Button>
      </form>

      <p className="text-muted text-center text-sm">
        {copy.signupPrompt}{' '}
        <Link
          href={nextParam ? `/signup?next=${encodeURIComponent(nextParam)}` : '/signup'}
          className="text-accent-ink underline-offset-4 hover:underline"
        >
          {copy.signupLink}
        </Link>
      </p>
    </div>
  )
}
