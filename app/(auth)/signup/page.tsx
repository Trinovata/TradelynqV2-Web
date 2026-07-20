import type { Metadata } from 'next'
import { Suspense } from 'react'
import { SignupForm } from './SignupForm'
import { AUTH_COPY } from '@/lib/copy/auth'

export const metadata: Metadata = {
  title: AUTH_COPY.signup.title,
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="h-[32rem]" aria-busy="true" />}>
      <SignupForm />
    </Suspense>
  )
}
