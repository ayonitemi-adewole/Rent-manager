// Supabase Auth errors, in words a landlord can act on.

type AuthLikeError = { code?: string; message?: string; status?: number }

export function friendlyAuthError(err: unknown): string {
  const e = (err ?? {}) as AuthLikeError
  const message = e.message ?? ''

  const wait = /after (\d+) seconds?/i.exec(message)
  if (wait) return `Please wait ${wait[1]} seconds before asking for another code.`

  switch (e.code) {
    case 'otp_expired':
      return 'That code is wrong or has expired. Check WhatsApp or your SMS, or send a new code.'
    case 'over_sms_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many codes requested. Please wait a few minutes and try again.'
    case 'sms_send_failed':
    case 'hook_timeout':
    case 'hook_timeout_after_retry':
    case 'hook_payload_invalid_content_type':
    case 'unexpected_failure':
      return 'We could not send your code just now. Please try again in a minute.'
    case 'phone_provider_disabled':
    case 'signup_disabled':
      return 'Sign-in by phone is not available right now. Please try again later.'
  }

  if (/token has expired or is invalid/i.test(message)) {
    return 'That code is wrong or has expired. Check WhatsApp or your SMS, or send a new code.'
  }
  if (message === 'Failed to fetch' || e.status === 0) return 'No connection. Check your internet and try again.'
  return 'Something went wrong. Please try again.'
}
