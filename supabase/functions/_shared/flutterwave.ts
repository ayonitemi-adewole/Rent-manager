// Minimal Flutterwave v3 client. Docs: https://developer.flutterwave.com/v3.0/reference
import { FALLBACK_BANKS } from './banks.ts'
import { requireEnv, UserError } from './http.ts'

const BASE = 'https://api.flutterwave.com/v3'

type FlwResponse<T> = { status: 'success' | 'error'; message: string; data: T }

async function flw<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireEnv('FLW_SECRET_KEY')}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  const body = (await res.json().catch(() => null)) as FlwResponse<T> | null
  if (!res.ok || body?.status !== 'success') {
    const message = body?.message ?? `HTTP ${res.status}`
    console.error(`Flutterwave ${init.method ?? 'GET'} ${path} failed: ${message}`)
    throw new FlutterwaveError(message, res.status)
  }
  return body.data
}

export class FlutterwaveError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

// ───────────── banks & payout ─────────────

export type Bank = { id: number; code: string; name: string }

/** Flutterwave's bank list, or a built-in list if that endpoint fails. Never throws for API errors. */
export async function listBanks(): Promise<Pick<Bank, 'code' | 'name'>[]> {
  try {
    const banks = await flw<Bank[]>('/banks/NG')
    if (banks.length > 0) return banks
  } catch (err) {
    if (!(err instanceof FlutterwaveError)) throw err
    console.warn('Using fallback bank list')
  }
  return FALLBACK_BANKS
}

export async function resolveAccount(accountNumber: string, bankCode: string): Promise<string> {
  try {
    const data = await flw<{ account_number: string; account_name: string }>('/accounts/resolve', {
      method: 'POST',
      body: JSON.stringify({ account_number: accountNumber, account_bank: bankCode }),
    })
    return data.account_name
  } catch (err) {
    if (err instanceof FlutterwaveError) {
      throw new UserError('We could not find that account. Check the bank and account number.')
    }
    throw err
  }
}

type SubaccountInput = {
  accountNumber: string
  bankCode: string
  businessName: string
  mobile: string
}

type Subaccount = { id: number; subaccount_id: string }

// split_value 0 → RentPadi takes no commission; the landlord receives the full amount
// (less Flutterwave's own fee).
const SPLIT = { split_type: 'percentage', split_value: 0 }

export const createSubaccount = (input: SubaccountInput) =>
  flw<Subaccount>('/subaccounts', {
    method: 'POST',
    body: JSON.stringify({
      account_bank: input.bankCode,
      account_number: input.accountNumber,
      business_name: input.businessName,
      business_mobile: input.mobile,
      country: 'NG',
      ...SPLIT,
    }),
  })

export const updateSubaccount = (ref: number, input: SubaccountInput) =>
  flw<Subaccount>(`/subaccounts/${ref}`, {
    method: 'PUT',
    body: JSON.stringify({
      account_bank: input.bankCode,
      account_number: input.accountNumber,
      business_name: input.businessName,
      ...SPLIT,
    }),
  })

// ───────────── payments ─────────────

type CreatePaymentInput = {
  txRef: string
  amountNaira: number
  redirectUrl: string
  subaccountId: string
  customer: { name: string; phone: string; email: string }
  title: string
  description: string
  meta: Record<string, string>
}

/** Flutterwave Standard: returns the hosted checkout URL. */
export async function createPaymentLink(input: CreatePaymentInput): Promise<string> {
  const data = await flw<{ link: string }>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      tx_ref: input.txRef,
      amount: input.amountNaira,
      currency: 'NGN',
      redirect_url: input.redirectUrl,
      subaccounts: [{ id: input.subaccountId }],
      customer: { name: input.customer.name, phonenumber: input.customer.phone, email: input.customer.email },
      customizations: { title: input.title, description: input.description },
      meta: input.meta,
    }),
  })
  return data.link
}

export type VerifiedTransaction = {
  id: number
  tx_ref: string
  status: string
  amount: number
  currency: string
  created_at: string
}

/** Ask Flutterwave directly. Never trust a webhook body or redirect query string on its own. */
export const verifyTransaction = (transactionId: number) =>
  flw<VerifiedTransaction>(`/transactions/${transactionId}/verify`)

export const verifyByReference = (txRef: string) =>
  flw<VerifiedTransaction>(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(txRef)}`)
