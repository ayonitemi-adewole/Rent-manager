// What came out of an online payment before it reached the landlord's bank. Landlords only:
// tenants pay exactly the rent and never see fees.

const GATEWAY_LABEL: Record<string, string> = { paystack: 'Paystack', flutterwave: 'Flutterwave' }

type PaymentFees = {
  method: string | null
  gateway: string | null
  amount_kobo: number | null
  gateway_fee_kobo: number | null
  platform_fee_kobo: number | null
}

export type FeeBreakdown = {
  /** "Paystack" */
  gateway: string
  gatewayFeeKobo: number
  platformFeeKobo: number
  /** What the landlord's bank receives: the rent minus both fees. */
  toBankKobo: number
}

/**
 * The fee breakdown of an online payment, or null when there is none to show: cash and
 * transfers recorded by hand, and older payments whose fee the payment company never reported.
 */
export function feeBreakdown(p: PaymentFees): FeeBreakdown | null {
  // typeof, not === null: a database without the fee columns yet returns undefined.
  if (p.method !== 'link' || typeof p.amount_kobo !== 'number' || typeof p.gateway_fee_kobo !== 'number') return null
  const platformFeeKobo = typeof p.platform_fee_kobo === 'number' ? p.platform_fee_kobo : 0
  return {
    gateway: GATEWAY_LABEL[p.gateway ?? ''] ?? 'Payment company',
    gatewayFeeKobo: p.gateway_fee_kobo,
    platformFeeKobo,
    toBankKobo: p.amount_kobo - p.gateway_fee_kobo - platformFeeKobo,
  }
}
