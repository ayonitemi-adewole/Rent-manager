// Landlord payout account: list banks, check an account name, save it as a Flutterwave subaccount.
// Requires a signed-in landlord. Body: { action: 'banks' } | { action: 'resolve' | 'save', bank_code, account_number }
import {
  createSubaccount,
  FlutterwaveError,
  listBanks,
  resolveAccount,
  updateSubaccount,
} from '../_shared/flutterwave.ts'
import { handler, json, readJson, UserError } from '../_shared/http.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'

/** Flutterwave's own message is the useful one for payout setup problems (bad key, rejected account…). */
async function withFlutterwaveMessage<T>(step: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof FlutterwaveError) throw new UserError(`${step}: ${err.message}`, 502)
    throw err
  }
}

type Body =
  | { action: 'banks' }
  | { action: 'resolve' | 'save'; bank_code?: string; account_number?: string }

Deno.serve(
  handler(async (req) => {
    const admin = adminClient()
    const user = await requireUser(req, admin)
    const body = await readJson<Body>(req)

    if (body.action === 'banks') {
      const banks = await withFlutterwaveMessage('Could not load banks from Flutterwave', listBanks)
      const sorted = banks
        .map(({ code, name }) => ({ code, name: name.trim() }))
        .sort((a, b) => a.name.localeCompare(b.name))
      return json({ banks: sorted })
    }

    if (body.action !== 'resolve' && body.action !== 'save') throw new UserError('Unknown action')

    const bankCode = String(body.bank_code ?? '').trim()
    const accountNumber = String(body.account_number ?? '').trim()
    if (!bankCode) throw new UserError('Choose your bank.')
    if (!/^\d{10}$/.test(accountNumber)) throw new UserError('Account numbers are 10 digits.')

    // Always resolve server-side: the name we store comes from the bank, not from the client.
    const accountName = await resolveAccount(accountNumber, bankCode)
    if (body.action === 'resolve') return json({ account_name: accountName })

    const { data: landlord, error } = await admin
      .from('landlords')
      .select('id, full_name, phone, flw_subaccount_ref')
      .eq('id', user.id)
      .maybeSingle()
    if (error) throw error
    if (!landlord) throw new UserError('Finish setting up your profile first.')

    const banks = await withFlutterwaveMessage('Could not load banks from Flutterwave', listBanks)
    const bankName = banks.find((b) => b.code === bankCode)?.name.trim() ?? null
    const input = {
      accountNumber,
      bankCode,
      businessName: landlord.full_name,
      mobile: String(landlord.phone).replace(/^\+/, ''),
    }
    const sub = await withFlutterwaveMessage('Flutterwave could not save this account', () =>
      landlord.flw_subaccount_ref
        ? updateSubaccount(landlord.flw_subaccount_ref, input)
        : createSubaccount(input),
    )

    const { error: updateError } = await admin
      .from('landlords')
      .update({
        bank_code: bankCode,
        bank_name: bankName,
        account_number: accountNumber,
        account_name: accountName,
        flw_subaccount_id: sub.subaccount_id,
        flw_subaccount_ref: sub.id,
        payout_updated_at: new Date().toISOString(),
      })
      .eq('id', landlord.id)
    if (updateError) throw updateError

    return json({ account_name: accountName, bank_name: bankName })
  }),
)
