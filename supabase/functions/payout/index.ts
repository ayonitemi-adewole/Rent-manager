// Landlord payout account: list banks, check an account name, save it as a Paystack subaccount.
// Requires a signed-in landlord. Body: { action: 'banks' }
//   | { action: 'resolve', bank_code, account_number }                             → { account_name, lookup }
//   | { action: 'send_code', bank_code, account_number }                           → { needed, sent_to?, phone_last4? }
//   | { action: 'save', bank_code, account_number, account_name?, lookup?, code? } → { account_name, bank_name }
//
// Replacing an account already on file needs the 6-digit code that send_code sends to the
// landlord's WhatsApp (migration 20261202090000_payout_codes.sql). Setting one up for the first
// time, or re-confirming the same account, doesn't (_shared/payout-change.ts).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0'
import { handler, json, readJson, requireEnv, UserError } from '../_shared/http.ts'
import { signLookup, verifyLookup } from '../_shared/lookup-proof.ts'
import { reportError } from '../_shared/monitoring.ts'
import { isPayoutChange } from '../_shared/payout-change.ts'
import {
  CHECK_MESSAGE,
  hashCode,
  ISSUE_MESSAGE,
  newCode,
  type CheckResult,
  type CodeFor,
  type IssueResult,
} from '../_shared/payout-code.ts'
import { createSubaccount, listBanks, PaystackError, resolveAccount, updateSubaccount } from '../_shared/paystack.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'
import { loginCodeTemplate } from '../_shared/wa-templates.ts'
import { sendWhatsApp, whatsappConfigFromEnv } from '../_shared/whatsapp.ts'

/** Paystack's own message is the useful one for payout setup problems (bad key, rejected account…). */
async function withPaystackMessage<T>(step: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof PaystackError) throw new UserError(`${step}: ${err.message}`, 502)
    throw err
  }
}

/**
 * Sends the code on WhatsApp (the login_code template). In demo mode, with WhatsApp not set up, it
 * goes to dev_sms_outbox like login codes do. Never logs the code.
 */
async function deliverCode(admin: SupabaseClient, phone: string, code: string): Promise<'whatsapp' | 'demo'> {
  const whatsapp = whatsappConfigFromEnv()
  if (whatsapp) {
    try {
      await sendWhatsApp(whatsapp, phone, loginCodeTemplate(code))
      return 'whatsapp'
    } catch (err) {
      console.error('payout: WhatsApp code send failed', err instanceof Error ? err.message : err)
      await reportError('payout', err, { step: 'send code' })
      throw new UserError('We couldn’t send the code on WhatsApp just now. Try again in a minute.', 502)
    }
  }
  const { error } = await admin.from('dev_sms_outbox').insert({ phone, otp: code })
  if (error) {
    await reportError('payout', new Error('Payout code: WhatsApp not set up and no dev_sms_outbox'))
    throw new UserError('Codes can’t be sent on WhatsApp yet. Please contact RentPadi support.', 503)
  }
  return 'demo'
}

/** Throws unless `code` is the current, unused code for exactly this account. */
async function requireCode(admin: SupabaseClient, secret: string, landlordId: string, codeFor: CodeFor, code: unknown) {
  const typed = String(code ?? '').trim()
  if (!/^\d{6}$/.test(typed)) throw new UserError('Enter the 6-digit code we sent to your WhatsApp.', 403)
  const { data, error } = await admin.rpc('check_payout_code', {
    p_landlord_id: landlordId,
    p_bank_code: codeFor.bankCode,
    p_account_number: codeFor.accountNumber,
    p_code_hash: await hashCode(secret, codeFor, typed),
  })
  if (error) throw error
  const result = data as CheckResult
  if (result !== 'ok') throw new UserError(CHECK_MESSAGE[result] ?? CHECK_MESSAGE.none, 403)
}

type Body =
  | { action: 'banks' }
  | {
      action: 'resolve' | 'save' | 'send_code'
      bank_code?: string
      account_number?: string
      account_name?: string
      lookup?: string
      code?: string
    }

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

    if (body.action !== 'resolve' && body.action !== 'save' && body.action !== 'send_code') {
      throw new UserError('Unknown action')
    }

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

    const secret = requireEnv('PAYSTACK_SECRET_KEY')
    const codeFor: CodeFor = { userId: user.id, bankCode, accountNumber }
    const changing = isPayoutChange(landlord, bankCode, accountNumber)

    if (body.action === 'send_code') {
      if (!landlord) throw new UserError('Finish setting up your profile first.')
      if (!changing) return json({ needed: false })
      const code = newCode()
      const { data: issued, error: issueError } = await admin.rpc('issue_payout_code', {
        p_landlord_id: landlord.id,
        p_bank_code: bankCode,
        p_account_number: accountNumber,
        p_code_hash: await hashCode(secret, codeFor, code),
      })
      if (issueError) throw issueError
      const result = issued as IssueResult
      if (result !== 'ok') throw new UserError(ISSUE_MESSAGE[result] ?? ISSUE_MESSAGE.wait, 429)
      const phone = `+${String(landlord.phone).replace(/^\+/, '')}`
      const sentTo = await deliverCode(admin, phone, code)
      return json({ needed: true, sent_to: sentTo, phone_last4: phone.slice(-4) })
    }

    // Checked before any Paystack call: no lookup or subaccount change without the code.
    if (body.action === 'save' && landlord && changing) {
      await requireCode(admin, secret, landlord.id, codeFor, body.code)
    }

    // The name we store always comes from a bank lookup, never from the client. Paystack limits
    // lookups (3 a day in test mode), so each save spends at most one:
    //  - the account already on file (e.g. confirming it after the move to Paystack) was looked up
    //    when it was saved, and only this function writes those columns: reuse its name;
    //  - a save brings the signed proof from its own lookup (lookup-proof.ts): reuse that name;
    //  - otherwise ask Paystack.
    const onFile =
      landlord?.account_name && landlord.bank_code === bankCode && landlord.account_number === accountNumber
        ? landlord.account_name
        : null
    const claimedName = String(body.account_name ?? '')
    const proven =
      body.action === 'save' &&
      claimedName !== '' &&
      (await verifyLookup(secret, { ...codeFor, accountName: claimedName }, String(body.lookup ?? '')))
    const accountName = onFile ?? (proven ? claimedName : await resolveAccount(accountNumber, bankCode))

    if (body.action === 'resolve') {
      const lookup = await signLookup(secret, { ...codeFor, accountName })
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

    // A code works once. Marked only now, so a Paystack hiccup above doesn't use it up. The account
    // is already saved by here, so a failure is reported rather than shown to the landlord.
    if (changing) {
      const { error: usedError } = await admin
        .from('payout_codes')
        .update({ used_at: new Date().toISOString() })
        .eq('landlord_id', landlord.id)
      if (usedError) await reportError('payout', usedError, { step: 'mark code used' })
    }

    return json({ account_name: accountName, bank_name: bankName })
  }),
)
