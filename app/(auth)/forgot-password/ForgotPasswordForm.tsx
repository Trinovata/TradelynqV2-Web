'use client'

import * as React from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { AUTH_COPY } from '@/lib/copy/auth'
import { whatsappLink } from '@/lib/utils/format'

const copy = AUTH_COPY.forgot

const schema = z.object({
  email: z.string().email(copy.emailError),
})

type FormValues = z.infer<typeof schema>

export function ForgotPasswordForm() {
  const [sent, setSent] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    const supabase = createClient()

    await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: new URL('/reset-password', window.location.origin).toString(),
    })

    // ALWAYS shows success, regardless of the outcome.
    //
    // This is deliberate and is the one place where hiding the answer is worth
    // the usability cost. A password-reset form that says "no account with that
    // email" lets anyone test addresses against the platform without
    // credentials, at scale, and the information is useful precisely because
    // people reuse addresses across services.
    //
    // The login form does distinguish the two — but there the user has already
    // supplied a password, and the signup form leaks the same fact anyway by
    // refusing duplicates. Here there is no such trade-off to make.
    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-display-md text-foreground">{copy.successHeading}</h1>
        <p className="text-body text-sm">{copy.successBody}</p>

        <a
          href={
            whatsappLink(
              process.env.NEXT_PUBLIC_TRADELYNQ_WHATSAPP,
              'Hi TradeLynq, I am having trouble resetting my password.'
            ) ?? '/support'
          }
          className="text-accent-ink text-sm underline-offset-4 hover:underline"
        >
          {copy.successHelp}
        </a>

        <Link href="/login" className="text-muted text-sm underline-offset-4 hover:underline">
          {copy.successBack}
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

        <Button type="submit" fullWidth isLoading={isSubmitting} loadingLabel={copy.submitLoading}>
          {copy.submit}
        </Button>
      </form>

      <p className="text-muted text-center text-sm">
        {copy.signinPrompt}{' '}
        <Link href="/login" className="text-accent-ink underline-offset-4 hover:underline">
          {copy.signinLink}
        </Link>
      </p>
    </div>
  )
}
