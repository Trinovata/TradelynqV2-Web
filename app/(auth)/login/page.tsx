import type { Metadata } from 'next'
import { Suspense } from 'react'
import { LoginForm } from './LoginForm'
import { AUTH_COPY } from '@/lib/copy/auth'

export const metadata: Metadata = {
  title: AUTH_COPY.login.title,
}

export default function LoginPage() {
  // The form reads `?next=` and `?switch=` from the URL, which requires
  // useSearchParams and therefore a Suspense boundary in Next 16. The fallback
  // mirrors the form's geometry so the swap does not shift the card.
  return (
    <Suspense fallback={<div className="h-96" aria-busy="true" />}>
      <LoginForm />
    </Suspense>
  )
}
