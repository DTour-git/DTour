// /login?error= carries a code, never text. Anyone can link to /login with any query, so the
// sign-in alert only ever shows copy written here; an unknown code gets the generic line.
export const LOGIN_ERRORS = {
  not_dtu: 'DTour is only for DTU students — sign in with your @dtu.ac.in email.',
  link_expired: 'That sign-in link has expired or isn’t valid. Ask for a new code.',
  cancelled: 'Google sign-in was cancelled. Try again when you’re ready.',
  signin_failed: 'Sign-in didn’t go through. Please try again.',
} as const;

export type LoginErrorCode = keyof typeof LOGIN_ERRORS;

/** The alert copy for a `?error=` value: null when there is none, the generic line when it's unknown. */
export function loginErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return Object.hasOwn(LOGIN_ERRORS, code) ? LOGIN_ERRORS[code as LoginErrorCode] : LOGIN_ERRORS.signin_failed;
}

const EXPIRED_CODES = new Set(['otp_expired', 'flow_state_expired', 'flow_state_not_found', 'bad_code_verifier']);

/**
 * Sorts a Supabase auth failure into one of our codes. `error` and `code` are Supabase's
 * error / error_code (from a redirect or an AuthError); `message` is its description. Only the
 * code leaves this function, so nothing from the failure is ever shown as-is.
 */
export function loginErrorCode({
  error,
  code,
  message,
}: {
  error?: string | null;
  code?: string | null;
  message?: string | null;
}): LoginErrorCode {
  const text = (message ?? '').toLowerCase();
  // The before_user_created hook rejects non-DTU addresses with a message naming the domain.
  if (text.includes('dtu.ac.in') || text.includes('only for dtu')) return 'not_dtu';
  if (code && EXPIRED_CODES.has(code)) return 'link_expired';
  if (text.includes('expired') || text.includes('invalid link')) return 'link_expired';
  if (error === 'access_denied' || code === 'access_denied') return 'cancelled';
  return 'signin_failed';
}

/** /login?error=<code> on the given origin. */
export function loginErrorUrl(origin: string, code: LoginErrorCode): URL {
  const url = new URL('/login', origin);
  url.searchParams.set('error', code);
  return url;
}
