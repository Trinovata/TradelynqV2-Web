'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AUTH_COPY, authErrorMessage } from '@/lib/copy/auth'
import { safeNextPath } from '@/lib/routes'
import { cn } from '@/lib/utils/cn'

const copy = AUTH_COPY.signup

const schema = z
  .object({
    fullName: z.string().min(2, copy.nameError),
    email: z.string().email(copy.emailError),
    password: z.string().min(8, copy.passwordError),
    confirmPassword: z.string(),
    // The checkbox is validated as a literal true rather than a boolean, so an
    // unticked box fails schema validation rather than submitting `false` and
    // relying on a separate check somewhere else.
    acceptedLegal: z.literal(true, { message: copy.legalError }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: copy.confirmError,
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof schema>

export function SignupForm() {
  const searchParams = useSearchParams()
  const nextParam = searchParams.get('next')
  const roleParam = searchParams.get('role')

  const [formError, setFormError] = React.useState<string | null>(null)
  const [sentTo, setSentTo] = React.useState<string | null>(null)
  const [resent, setResent] = React.useState(false)
  const [googleLoading, setGoogleLoading] = React.useState(false)

  const isProfessional =
    roleParam === 'professional' || roleParam === 'worker' || roleParam === 'business'

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    setFormError(null)

    const supabase = createClient()
    const callback = new URL('/auth/callback', window.location.origin)
    if (nextParam) callback.searchParams.set('next', safeNextPath(nextParam, '/'))

    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: callback.toString(),
        // Read by the handle_new_user trigger. Only the display name — never
        // anything that grants authority, since user metadata is client-supplied
        // and a `role` here would be self-assigned privilege.
        data: { full_name: values.fullName },
      },
    })

    if (error) {
      setFormError(authErrorMessage(error.code, 'signup'))
      return
    }

    setSentTo(values.email)
  }

  async function onGoogle() {
    // Read at click time rather than subscribing with watch(): the value is only
    // needed here, and a subscription re-renders the whole form on every
    // keystroke elsewhere in it.
    if (!getValues('acceptedLegal')) {
      setFormError(copy.googleWithoutLegal)
      return
    }

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
      setFormError(AUTH_COPY.login.googleError)
      setGoogleLoading(false)
    }
  }

  async function onResend() {
    if (!sentTo) return
    const supabase = createClient()
    await supabase.auth.resend({ type: 'signup', email: sentTo })
    setResent(true)
  }

  // ── Confirmation sent ─────────────────────────────────────────────────────
  if (sentTo) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-display-md text-foreground">{copy.confirmationHeading}</h1>
        <p className="text-body text-sm">{copy.confirmationBody(sentTo)}</p>
        <p className="text-muted text-xs">{copy.confirmationHint}</p>

        {resent ? (
          <p className="text-success text-sm">{copy.confirmationResent}</p>
        ) : (
          <Button variant="secondary" onClick={onResend}>
            {copy.confirmationResend}
          </Button>
        )}

        <Link href="/login" className="text-accent-ink text-sm underline-offset-4 hover:underline">
          {copy.goToSignIn}
        </Link>
      </div>
    )
  }

  // ── The form ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-display-md text-foreground">{copy.heading}</h1>
        <p className="text-muted text-sm">
          {isProfessional ? copy.subProfessional : copy.subCustomer}
        </p>
        {roleParam && (
          <p className="text-muted text-xs">
            {copy.roleNote(isProfessional ? 'professional' : 'customer')}
          </p>
        )}
        {nextParam && <p className="text-muted text-xs">{copy.nextPathNote}</p>}
      </header>

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
        loadingLabel={AUTH_COPY.login.googleLoading}
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
          label={copy.nameLabel}
          placeholder={copy.namePlaceholder}
          autoComplete="name"
          error={errors.fullName?.message}
          required
          {...register('fullName')}
        />
        <Input
          label={copy.emailLabel}
          placeholder={copy.emailPlaceholder}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          required
          {...register('email')}
        />
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

        <div className="flex flex-col gap-1.5">
          <label className="text-body flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              className={cn(
                'border-border accent-accent mt-0.5 size-4 shrink-0 rounded-[3px] border',
                'focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2'
              )}
              aria-invalid={errors.acceptedLegal ? true : undefined}
              {...register('acceptedLegal')}
            />
            <span>{copy.legalLabel}</span>
          </label>
          {errors.acceptedLegal && (
            <p role="alert" className="text-destructive text-xs">
              {errors.acceptedLegal.message}
            </p>
          )}
        </div>

        <Button type="submit" fullWidth isLoading={isSubmitting} loadingLabel={copy.submitLoading}>
          {copy.submit}
        </Button>
      </form>

      <p className="text-muted text-center text-sm">
        {copy.signinPrompt}{' '}
        <Link
          href={nextParam ? `/login?next=${encodeURIComponent(nextParam)}` : '/login'}
          className="text-accent-ink underline-offset-4 hover:underline"
        >
          {copy.signinLink}
        </Link>
      </p>
    </div>
  )
}
