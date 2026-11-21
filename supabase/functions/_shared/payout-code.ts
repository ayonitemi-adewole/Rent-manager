// The 6-digit code a landlord enters before changing their payout account.
// Issued and checked by public.issue_payout_code / check_payout_code
// (migration 20261202090000_payout_codes.sql); sent with the login_code WhatsApp template.

const ONE_MILLION = 1_000_000
// The largest multiple of a million below 2^32: random values at or above it are redrawn, so
// every code from 000000 to 999999 is equally likely.
const FAIR_LIMIT = Math.floor(0x1_0000_0000 / ONE_MILLION) * ONE_MILLION

/** A random 6-digit code from the platform's secure random source. */
export function newCode(fill: (buf: Uint32Array) => Uint32Array = (buf) => crypto.getRandomValues(buf)): string {
  const buf = new Uint32Array(1)
  for (;;) {
    const n = fill(buf)[0]
    if (n < FAIR_LIMIT) return String(n % ONE_MILLION).padStart(6, '0')
  }
}

/** Who the code is for and the account it approves. */
export type CodeFor = { userId: string; bankCode: string; accountNumber: string }

/** Only this HMAC is stored, never the code. Tied to the landlord and the account it approves. */
export async function hashCode(secret: string, codeFor: CodeFor, code: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  // Labelled, so this can't be mistaken for any other signature made with the same secret.
  const message = JSON.stringify([
    'rentpadi-payout-code-v1',
    codeFor.userId,
    codeFor.bankCode,
    codeFor.accountNumber,
    code,
  ])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)))
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('')
}

export type IssueResult = 'ok' | 'wait' | 'limit'
export type CheckResult = 'ok' | 'wrong' | 'locked' | 'expired' | 'none'

/** What to tell the landlord when a code can't be sent. */
export const ISSUE_MESSAGE: Record<Exclude<IssueResult, 'ok'>, string> = {
  wait: 'A code was just sent. Wait a minute before asking for another.',
  limit: 'That’s the most codes for one day. Try again tomorrow, or contact RentPadi support.',
}

/** What to tell the landlord when a code isn't accepted. */
export const CHECK_MESSAGE: Record<Exclude<CheckResult, 'ok'>, string> = {
  wrong: 'That code isn’t right. Check the latest WhatsApp message from RentPadi and try again.',
  locked: 'Too many wrong tries. Ask for a new code.',
  expired: 'That code has expired. Ask for a new one.',
  none: 'Ask for a code for this account first.',
}
