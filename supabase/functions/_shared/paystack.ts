// Minimal Paystack client. Docs: https://paystack.com/docs/api/
// Amounts are in kobo, like everywhere else in RentPadi.
import { FALLBACK_BANKS } from './banks.ts'
import { requireEnv, UserError } from './http.ts'

const BASE = 'https://api.paystack.co'

type PaystackResponse<T> = { status: boolean; message: string; data: T; meta?: { next?: string | null } }

async function paystack<T>(path: string, init: RequestInit = {}): Promise<PaystackResponse<T>> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireEnv('PAYSTACK_SECRET_KEY')}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  const body = (await res.json().catch(() => null)) as PaystackResponse<T> | null
  if (!res.ok || body?.status !== true) {
    const message = body?.message ?? `HTTP ${res.status}`
    console.error(`Paystack ${init.method ?? 'GET'} ${path.split('?')[0]} failed: ${message}`)
    throw new PaystackError(message, res.status)
  }
  return body
}

export class PaystackError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

// ───────────── banks & payout ─────────────

type PaystackBank = { name: string; code: string; active: boolean; is_deleted: boolean | null }

/** Paystack's Nigerian bank list (all pages), or a built-in list if that fails. Never throws for API errors. */
export async function listBanks(): Promise<{ code: string; name: string }[]> {
  try {
    const banks = new Map<string, string>()
    let next: string | null | undefined = undefined
    // A few pages of 100 at most; the cap stops a runaway loop if the cursor misbehaves.
    for (let page = 0; page < 10; page++) {
      const cursor: string = next ? `&next=${encodeURIComponent(next)}` : ''
      const res: PaystackResponse<PaystackBank[]> = await paystack<PaystackBank[]>(
        `/bank?country=nigeria&currency=NGN&perPage=100&use_cursor=true${cursor}`,
      )
      for (const b of res.data) if (b.active && !b.is_deleted && !banks.has(b.code)) banks.set(b.code, b.name)
      next = res.meta?.next
      if (!next) break
    }
    if (banks.size > 0) return [...banks].map(([code, name]) => ({ code, name }))
  } catch (err) {
    if (!(err instanceof PaystackError)) throw err
  }
  console.warn('Using fallback bank list')
  return FALLBACK_BANKS
}

/** Paystack's answer when the bank has no such account (422 "Could not resolve account name…"). */
export const isAccountNotFound = (err: PaystackError) =>
  err.status === 422 || /could not resolve|invalid account|account not found/i.test(err.message)

/**
 * The account holder's name, as the bank has it. Throws UserError: "not found" for a wrong
 * account, otherwise Paystack's own reason (e.g. a lookup limit), so the real problem is visible.
 */
export async function resolveAccount(accountNumber: string, bankCode: string): Promise<string> {
  try {
    const { data } = await paystack<{ account_number: string; account_name: string }>(
      `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    )
    return data.account_name
  } catch (err) {
    if (err instanceof PaystackError) {
      if (isAccountNotFound(err)) {
        throw new UserError('We could not find that account. Check the bank and account number.')
      }
      throw new UserError(`Paystack could not check this account right now: ${err.message}`, 502)
    }
    throw err
  }
}

type SubaccountInput = {
  accountNumber: string
  bankCode: string
  businessName: string
  /** Settlement and payout notices go here. */
  email: string
  contactName: string
  phone: string
}

export type Subaccount = { id: number; subaccount_code: string }

const subaccountBody = (input: SubaccountInput) =>
  JSON.stringify({
    business_name: input.businessName,
    settlement_bank: input.bankCode,
    account_number: input.accountNumber,
    // RentPadi's share of each payment, in percent. 0: the landlord gets all the rent
    // (less Paystack's fee, which the landlord's share bears; see initializeTransaction).
    percentage_charge: 0,
    description: 'RentPadi landlord payout',
    primary_contact_email: input.email,
    primary_contact_name: input.contactName,
    primary_contact_phone: input.phone,
  })

export const createSubaccount = async (input: SubaccountInput) =>
  (await paystack<Subaccount>('/subaccount', { method: 'POST', body: subaccountBody(input) })).data

export const updateSubaccount = async (code: string, input: SubaccountInput) =>
  (await paystack<Subaccount>(`/subaccount/${encodeURIComponent(code)}`, { method: 'PUT', body: subaccountBody(input) }))
    .data

// ───────────── payments ─────────────

type InitializeInput = {
  reference: string
  amountKobo: number
  email: string
  callbackUrl: string
  /** Where Paystack sends the tenant if they close the checkout without paying. */
  cancelUrl: string
  subaccountCode: string
  metadata: Record<string, string>
  /** Shown on the Paystack dashboard against the transaction. */
  customFields: { display_name: string; variable_name: string; value: string }[]
}

/** Starts a Paystack checkout and returns its URL. */
export async function initializeTransaction(input: InitializeInput): Promise<string> {
  const { data } = await paystack<{ authorization_url: string; reference: string }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      reference: input.reference,
      amount: input.amountKobo,
      currency: 'NGN',
      email: input.email,
      callback_url: input.callbackUrl,
      subaccount: input.subaccountCode,
      // The landlord's share carries Paystack's fee, so the tenant pays exactly the rent and
      // RentPadi (0% split) never pays fees on money it doesn't keep.
      bearer: 'subaccount',
      metadata: { ...input.metadata, cancel_action: input.cancelUrl, custom_fields: input.customFields },
    }),
  })
  return data.authorization_url
}

export type VerifiedTransaction = {
  id: number
  reference: string
  /** success | failed | abandoned | reversed | ongoing | pending | processing | queued */
  status: string
  /** Kobo. */
  amount: number
  currency: string
  paid_at: string | null
  created_at: string
  gateway_response: string | null
}

/** Ask Paystack directly. Never trust a webhook body or redirect query string on its own. */
export const verifyTransaction = async (reference: string) =>
  (await paystack<VerifiedTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`)).data

// ───────────── webhooks ─────────────

/** Paystack signs each webhook body with HMAC-SHA512 of the secret key (x-paystack-signature, hex). */
export async function isValidSignature(rawBody: string, signature: string, secretKey: string): Promise<boolean> {
  if (!signature) return false
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretKey),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)))
  const expected = Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('')
  const given = signature.trim().toLowerCase()
  let diff = expected.length ^ given.length
  for (let i = 0; i < Math.max(expected.length, given.length); i++) {
    diff |= (expected.charCodeAt(i) || 0) ^ (given.charCodeAt(i) || 0)
  }
  return diff === 0
}
