import { describe, expect, it } from 'vitest'
import { friendlyAuthError } from './auth-errors'

describe('friendlyAuthError', () => {
  it('explains a wrong or expired code', () => {
    expect(friendlyAuthError({ code: 'otp_expired', message: 'Token has expired or is invalid' })).toMatch(
      /wrong or has expired/,
    )
    expect(friendlyAuthError({ message: 'Token has expired or is invalid' })).toMatch(/wrong or has expired/)
  })
  it('passes on how long to wait before resending', () => {
    expect(
      friendlyAuthError({
        code: 'over_sms_send_rate_limit',
        message: 'For security purposes, you can only request this after 42 seconds.',
      }),
    ).toBe('Please wait 42 seconds before asking for another code.')
  })
  it('explains an SMS that could not be sent', () => {
    expect(friendlyAuthError({ code: 'sms_send_failed', message: 'Error sending sms: …' })).toMatch(/could not send/)
  })
  it('never shows raw server text', () => {
    expect(friendlyAuthError({ code: 'weird', message: 'pq: internal' })).toBe('Something went wrong. Please try again.')
  })
  it('explains no connection', () => {
    expect(friendlyAuthError({ message: 'Failed to fetch' })).toMatch(/No connection/)
  })
})
