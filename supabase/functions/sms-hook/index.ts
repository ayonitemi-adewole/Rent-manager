// Supabase Auth "Send SMS" hook: texts the landlord's login code through Termii.
//
// Switch on (after Termii approves the sender ID):
//   1. supabase secrets set TERMII_API_KEY=… TERMII_SENDER_ID=… TERMII_BASE_URL=… SEND_SMS_HOOK_SECRET=…
//   2. Dashboard → Authentication → Hooks → Send SMS → HTTPS → this function's URL; copy its secret
//      into SEND_SMS_HOOK_SECRET.
// Until then the Postgres hook (dev_send_sms_hook) stays active and codes go to dev_sms_outbox.

import { sendSms, termiiConfigFromEnv } from '../_shared/termii.ts'
import { verifyWebhook } from '../_shared/webhook.ts'

type HookPayload = { user?: { phone?: string }; sms?: { otp?: string } }

export const otpMessage = (otp: string) => `Your RentPadi code is ${otp}. Do not share it with anyone.`

/** Supabase Auth reads `error.message` from failed hooks and shows a generic error to the user. */
function hookError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function handleSmsHook(req: Request, deps = { sendSms, termiiConfigFromEnv }): Promise<Response> {
  if (req.method !== 'POST') return hookError(405, 'Method not allowed')
  const body = await req.text()

  const secret = Deno.env.get('SEND_SMS_HOOK_SECRET')
  if (!secret || !(await verifyWebhook(secret, req.headers, body))) {
    console.warn('sms-hook: rejected unsigned or badly signed request')
    return hookError(401, 'Invalid signature')
  }

  let payload: HookPayload
  try {
    payload = JSON.parse(body) as HookPayload
  } catch {
    return hookError(400, 'Invalid JSON')
  }
  const phone = payload.user?.phone
  const otp = payload.sms?.otp
  if (!phone || !otp) return hookError(400, 'Missing phone or code')

  try {
    // Auth stores the phone without '+'.
    await deps.sendSms(deps.termiiConfigFromEnv(), `+${phone.replace(/^\+/, '')}`, otpMessage(otp))
  } catch (err) {
    console.error('sms-hook: Termii send failed', err) // never log the code itself
    return hookError(502, 'Could not send the SMS. Please try again shortly.')
  }
  return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
}

if (import.meta.main) Deno.serve((req) => handleSmsHook(req))
