import type { Metadata } from 'next'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import { AUTH_COPY } from '@/lib/copy/auth'

export const metadata: Metadata = {
  title: AUTH_COPY.forgot.title,
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
