import { describe, expect, it } from 'vitest'
import { feeBreakdown } from './fees'
import { formatKoboExact } from './money'

const online = {
  method: 'link',
  gateway: 'paystack',
  amount_kobo: 10_000_000, // ₦100,000
  gateway_fee_kobo: 32_250, // ₦322.50
  platform_fee_kobo: 0,
}

describe('feeBreakdown', () => {
  it('takes both fees off the rent', () => {
    expect(feeBreakdown(online)).toEqual({
      gateway: 'Paystack',
      gatewayFeeKobo: 32_250,
      platformFeeKobo: 0,
      toBankKobo: 9_967_750, // ₦99,677.50
    })
  })

  it('includes a RentPadi fee when there is one (Padi Free)', () => {
    expect(feeBreakdown({ ...online, platform_fee_kobo: 100_000 })?.toBankKobo).toBe(9_867_750)
  })

  it('has nothing to show for cash or transfers recorded by hand', () => {
    expect(feeBreakdown({ ...online, method: 'cash', gateway: null, gateway_fee_kobo: null })).toBeNull()
    expect(feeBreakdown({ ...online, method: 'transfer', gateway: null, gateway_fee_kobo: null })).toBeNull()
  })

  it('has nothing to show when the payment company never reported its fee', () => {
    expect(feeBreakdown({ ...online, gateway: 'flutterwave', gateway_fee_kobo: null, platform_fee_kobo: null })).toBeNull()
  })

  it('shows nothing (not NaN) before the database has the fee columns', () => {
    const { gateway_fee_kobo: _g, platform_fee_kobo: _p, ...before } = online
    expect(feeBreakdown(before as typeof online)).toBeNull()
  })

  it('treats a missing RentPadi fee as none', () => {
    expect(feeBreakdown({ ...online, platform_fee_kobo: null })?.platformFeeKobo).toBe(0)
  })
})

describe('formatKoboExact', () => {
  it('always shows two kobo digits when there are kobo', () => {
    expect(formatKoboExact(32_250)).toBe('₦322.50')
    expect(formatKoboExact(9_967_750)).toBe('₦99,677.50')
  })

  it('keeps whole naira short', () => {
    expect(formatKoboExact(100_000)).toBe('₦1,000')
    expect(formatKoboExact(0)).toBe('₦0')
  })
})
