/**
 * Auth copy, verbatim from `details/copy-public.md` §15.
 *
 * Strings live here rather than inline in the pages because the copy deck is
 * the source of truth, and a string typed into a component drifts from it
 * silently. Changing user-facing wording should mean changing the deck and then
 * this file — never a component.
 *
 * Error copy maps from an error CODE, never from a provider's message. Supabase
 * returns things like "Invalid login credentials", which is both un-Commonwealth
 * and tells an attacker whether the email exists. The mapping below is what the
 * user actually reads.
 */

export const AUTH_COPY = {
  login: {
    title: 'Log in',
    heading: 'Welcome back',
    sub: 'Enter your details to continue.',
    subSwitching: 'Switch accounts and continue.',
    nextPathNote: "You'll continue to your requested page after sign in.",
    google: 'Continue with Google',
    googleLoading: 'Redirecting…',
    divider: 'or sign in with email',
    emailLabel: 'Email address',
    emailPlaceholder: 'you@example.com',
    emailError: 'Enter a valid email address',
    passwordLabel: 'Password',
    passwordError: 'Password is required',
    forgot: 'Forgot password?',
    submit: 'Sign in',
    submitLoading: 'Signing in…',
    signupPrompt: "Don't have an account?",
    signupLink: 'Sign up free',
    unconfirmedHeading: 'Please confirm your email first',
    unconfirmedBody: (email: string) =>
      `We sent a confirmation link to ${email}. Check your inbox and spam folder.`,
    resend: 'Resend confirmation email',
    resendLoading: 'Resending…',
    resendDone: 'Confirmation email resent.',
    googleError: 'Google sign-in failed. Please try again.',
  },

  signup: {
    title: 'Sign up',
    heading: 'Create your account',
    subCustomer: 'Join free. Browse, save, and hire in minutes.',
    // NOTE: the deck's professional sub-line quotes "50% off your first 3
    // months", and flags that the Pioneer offer supersedes it for the launch
    // cohort. Pioneer is the live offer, so this line reflects Pioneer and the
    // discrepancy is recorded rather than silently resolved either way.
    subProfessional:
      'TTD $200 registration fee. Your first 3 months are free while Pioneer places last.',
    roleNote: (role: string) =>
      `You're signing up as a ${role}. You can change this on the next step.`,
    nextPathNote: "After sign-up, we'll continue to your requested page.",
    google: 'Continue with Google',
    divider: 'or sign up with email',
    nameLabel: 'Full name',
    namePlaceholder: 'Maria Gonzalez',
    nameError: 'Enter your full name',
    emailLabel: 'Email address',
    emailPlaceholder: 'you@example.com',
    emailError: 'Enter a valid email address',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Min. 8 characters',
    passwordError: 'Password must be at least 8 characters',
    confirmLabel: 'Confirm password',
    confirmError: 'Passwords do not match',
    legalLabel:
      'I have read and agree to the Terms of Service, Privacy Policy, User Agreement (EULA), and Reviews Policy.',
    legalError: 'You must accept the legal documents to create an account.',
    googleWithoutLegal: 'Please accept the legal documents before continuing.',
    submit: 'Create account',
    submitLoading: 'Creating account…',
    signinPrompt: 'Already have an account?',
    signinLink: 'Sign in',
    confirmationHeading: 'Check your inbox',
    confirmationBody: (email: string) => `We sent a confirmation link to ${email}.`,
    confirmationHint:
      "Click the link in that email to activate your TradeLynq account. If you don't see it, check spam or promotions.",
    confirmationResend: 'Resend confirmation email',
    confirmationResent: 'Confirmation email resent',
    goToSignIn: 'Go to sign in',
  },

  forgot: {
    title: 'Reset your password',
    heading: 'Reset your password',
    sub: "Enter your email and we'll send you a reset link.",
    emailLabel: 'Email address',
    emailPlaceholder: 'you@example.com',
    emailError: 'Enter a valid email address',
    submit: 'Send reset link',
    submitLoading: 'Sending…',
    successHeading: 'Check your email',
    successBody: 'We sent a password reset link to your email address.',
    successHelp: 'Still having trouble? Message us on WhatsApp',
    successBack: 'Back to sign in',
    error: 'Could not send reset email. Please try again or contact us on WhatsApp.',
    signinPrompt: 'Remembered it?',
    signinLink: 'Sign in',
  },

  reset: {
    title: 'Set a new password',
    processing: 'Processing your reset link…',
    processingFallback: 'If nothing happens, request a new link.',
    heading: 'Set a new password',
    sub: 'Use at least 8 characters so your account stays secure.',
    passwordLabel: 'New password',
    passwordPlaceholder: 'Min. 8 characters',
    passwordError: 'Password must be at least 8 characters',
    confirmLabel: 'Confirm password',
    confirmError: "Passwords don't match",
    submit: 'Update password',
    submitLoading: 'Updating…',
    error: "Couldn't update your password. Request a new reset link and try again.",
  },

  selectRole: {
    title: 'Choose your account type',
    heading: 'How will you use TradeLynq?',
    sub: 'You can change this within 72 hours.',
    customerTitle: "I'm a customer",
    customerBody: 'Search and hire professionals. Free, forever.',
    professionalTitle: "I'm a professional",
    professionalBody: 'List my services and receive enquiries.',
    subtypes: [
      { id: 'student_entrepreneur', title: 'Student Entrepreneur', body: '16–26, starting out.' },
      { id: 'sole_trader', title: 'Small Business', body: 'Sole trader or informal business.' },
      {
        id: 'registered_business',
        title: 'Registered Business',
        body: 'A legally registered company.',
      },
    ],
    continue: 'Continue',
    changeLaterNote: 'Not sure? Pick what fits best now — you can change it within 72 hours.',
  },
} as const

/**
 * Maps an auth failure to the sentence the user reads.
 *
 * Deliberately NOT keyed off the provider's message text. Two reasons: provider
 * wording changes without notice and would silently degrade the copy, and
 * Supabase's own strings are American-spelled and sometimes disclose whether an
 * account exists.
 *
 * `user_not_found` is the interesting case. Distinguishing "no such account"
 * from "wrong password" is technically an enumeration oracle — but the signup
 * form already reveals the same fact by refusing duplicate emails, so hiding it
 * here would cost real usability for no gain. The copy deck makes that call
 * explicitly; this comment records that it was a call, not an oversight.
 */
export function authErrorMessage(code: string | undefined, context: 'login' | 'signup'): string {
  if (context === 'login') {
    switch (code) {
      case 'invalid_credentials':
        return 'Incorrect email or password. Please check and try again.'
      case 'user_not_found':
        return 'No account found with that email address. Did you mean to sign up?'
      case 'over_request_rate_limit':
      case 'RATE_LIMITED':
        return 'Too many attempts. Please wait a few minutes before trying again.'
      case 'user_banned':
        return 'This account has been suspended. Please contact TradeLynq support.'
      default:
        return 'Something went wrong. Please try again or message us on WhatsApp for help.'
    }
  }

  switch (code) {
    case 'user_already_exists':
    case 'email_exists':
      return 'An account with this email already exists. Try signing in instead.'
    case 'weak_password':
      return 'Password is too weak. Use at least 8 characters with a mix of letters and numbers.'
    case 'over_request_rate_limit':
    case 'RATE_LIMITED':
      return 'Too many sign-up attempts. Please wait a few minutes and try again.'
    case 'signup_disabled':
      return 'Sign-ups are temporarily paused. Please try again shortly or contact us on WhatsApp.'
    case 'email_address_invalid':
      return 'That email address appears to be invalid. Please double-check it.'
    default:
      return 'Something went wrong creating your account. Please try again or contact us on WhatsApp.'
  }
}
