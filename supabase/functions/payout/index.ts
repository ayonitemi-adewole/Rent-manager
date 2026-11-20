// Landlord payout account: list banks, check an account name, save it as a Paystack subaccount.
// Requires a signed-in landlord. Body: { action: 'banks' }
//   | { action: 'resolve', bank_code, account_number }                       → { account_name, lookup }
//   | { action: 'save', bank_code, account_number, account_name?, lookup? }  → { account_name, bank_name }
import { handler, json, readJson, requireEnv, UserError } from '../_shared/http.ts'
import { signLookup, verifyLookup } from '../_shared/lookup-proof.ts'
import { createSubaccount, listBanks, PaystackError, resolveAccount, updateSubaccount } from '../_shared/paystack.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'

/** Paystack's own message is the useful one for payout setup problems (bad key, rejected account…). */
async function withPaystackMessage<T>(step: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof PaystackError) throw new UserError(`${step}: ${err.message}`, 502)
    throw err
  }
}

type Body =
  | { action: 'banks' }
  | { action: 'resolve' | 'save'; bank_code?: string; account_number?: string; account_name?: string; lookup?: string }

Deno.serve(
  handler(async (req) => {
    const admin = adminClient()
    const user = await requireUser(req, admin)
    const body = await readJson<Body>(req)

    if (body.action === 'banks') {
      const banks = (await listBanks())
        .map(({ code, name }) => ({ code, name: name.trim() }))
        .sort((a, b) => a.name.localeCompare(b.name))
      return json({ banks })
    }

    if (body.action !== 'resolve' && body.action !== 'save') throw new UserError('Unknown action')

    const bankCode = String(body.bank_code ?? '').trim()
    const accountNumber = String(body.account_number ?? '').trim()
    if (!bankCode) throw new UserError('Choose your bank.')
    if (!/^\d{10}$/.test(accountNumber)) throw new UserError('Account numbers are 10 digits.')

    const { data: landlord, error } = await admin
      .from('landlords')
      .select('id, full_name, name_for_tenants, email, phone, paystack_subaccount_code, bank_code, account_number, account_name')
      .eq('id', user.id)
      .maybeSingle()
    if (error) throw error

    // The name we store always comes from a bank lookup, never from the client. Paystack limits
    // lookups (3 a day in test mode), so each save spends at most one:
    //  - the account already on file (e.g. confirming it after the move to Paystack) was looked up
    //    when it was saved, and only this function writes those columns: reuse its name;
    //  - a save brings the signed proof from its own lookup (lookup-proof.ts): reuse that name;
    //  - otherwise ask Paystack.
    const secret = requireEnv('PAYSTACK_SECRET_KEY')
    const onFile =
      landlord?.account_name && landlord.bank_code === bankCode && landlord.account_number === accountNumber
        ? landlord.account_name
        : null
    const claimedName = String(body.account_name ?? '')
    const proven =
      body.action === 'save' &&
      claimedName !== '' &&
      (await verifyLookup(
        secret,
        { userId: user.id, bankCode, accountNumber, accountName: claimedName },
        String(body.lookup ?? ''),
      ))
    const accountName = onFile ?? (proven ? claimedName : await resolveAccount(accountNumber, bankCode))

    if (body.action === 'resolve') {
      const lookup = await signLookup(secret, { userId: user.id, bankCode, accountNumber, accountName })
      return json({ account_name: accountName, lookup })
    }

    if (!landlord) throw new UserError('Finish setting up your profile first.')

    const bankName = (await listBanks()).find((b) => b.code === bankCode)?.name.trim() ?? null
    const phone = String(landlord.phone)
    const input = {
      accountNumber,
      bankCode,
      businessName: landlord.name_for_tenants,
      contactName: landlord.full_name,
      phone,
      // Collected at onboarding. Landlords from before onboarding asked for it get a stable placeholder.
      email:
        landlord.email ??
        `${phone.replace(/^\+/, '')}@${Deno.env.get('LANDLORD_EMAIL_DOMAIN') ?? 'landlords.rentpadi.app'}`,
    }
    const sub = await withPaystackMessage('Paystack could not save this account', () =>
      landlord.paystack_subaccount_code
        ? updateSubaccount(landlord.paystack_subaccount_code, input)
        : createSubaccount(input),
    )

    const { error: updateError } = await admin
      .from('landlords')
      .update({
        bank_code: bankCode,
        bank_name: bankName,
        account_number: accountNumber,
        account_name: accountName,
        paystack_subaccount_code: sub.subaccount_code,
        paystack_subaccount_id: sub.id,
        payout_updated_at: new Date().toISOString(),
      })
      .eq('id', landlord.id)
    if (updateError) throw updateError

    return json({ account_name: accountName, bank_name: bankName })
  }),
)
