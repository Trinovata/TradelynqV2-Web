import type { Metadata } from 'next'
import { ResetPasswordForm } from './ResetPasswordForm'
import { AUTH_COPY } from '@/lib/copy/auth'

export const metadata: Metadata = {
  title: AUTH_COPY.reset.title,
  // A reset link must never be indexed, and must not leak into a referrer
  // header if the page links onward.
  robots: { index: false, follow: false },
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />
}
