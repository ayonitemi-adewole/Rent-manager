// Supabase Auth "Send SMS" hook: delivers the landlord's login code on WhatsApp and/or by SMS.
//
// Channels are tried in order (OTP_CHANNELS, default "whatsapp,sms"); the first one that accepts
// the message wins. A channel is skipped if it isn't set up:
//   - WhatsApp: WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID, and an approved "login_code"
//     Authentication template (docs/WHATSAPP_SETUP.md).
//   - SMS: TERMII_API_KEY + TERMII_SENDER_ID (+ TERMII_BASE_URL).
//
// Switch on: Dashboard → Authentication → Auth Hooks → Send SMS → HTTPS → this function's URL,
// then `supabase secrets set SEND_SMS_HOOK_SECRET='v1,whsec_…'` with the secret it generates.
// Until then the Postgres hook (dev_send_sms_hook) stays active and codes go to dev_sms_outbox.

import { sendSms, termiiConfigFromEnv, type TermiiConfig } from '../_shared/termii.ts'
import { loginCodeTemplate } from '../_shared/wa-templates.ts'
import { verifyWebhook, WebhookSecretError } from '../_shared/webhook.ts'
import { sendWhatsApp, whatsappConfigFromEnv, type WhatsAppConfig } from '../_shared/whatsapp.ts'

type HookPayload = { user?: { phone?: string }; sms?: { otp?: string } }

export type OtpChannel = 'whatsapp' | 'sms'

export const otpMessage = (otp: string) => `Your RentPadi code is ${otp}. Do not share it with anyone.`

export type HookDeps = {
  /** Order to try channels in; unknown names are ignored. */
  channels: OtpChannel[]
  whatsapp: WhatsAppConfig | null
  termii: TermiiConfig | null
  sendWhatsApp: typeof sendWhatsApp
  sendSms: typeof sendSms
}

export function parseChannels(value: string | undefined): OtpChannel[] {
  const wanted = (value ?? 'whatsapp,sms').split(',').map((c) => c.trim().toLowerCase())
  const channels = wanted.filter((c): c is OtpChannel => c === 'whatsapp' || c === 'sms')
  return [...new Set(channels)]
}

export const depsFromEnv = (): HookDeps => ({
  channels: parseChannels(Deno.env.get('OTP_CHANNELS')),
  whatsapp: whatsappConfigFromEnv(),
  termii: termiiConfigFromEnv(),
  sendWhatsApp,
  sendSms,
})

/** Supabase Auth reads `error.message` from failed hooks and shows a generic error to the user. */
function hookError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function handleSmsHook(req: Request, deps: HookDeps = depsFromEnv()): Promise<Response> {
  if (req.method !== 'POST') return hookError(405, 'Method not allowed')
  const body = await req.text()

  const secret = Deno.env.get('SEND_SMS_HOOK_SECRET')
  let signed = false
  try {
    signed = Boolean(secret) && (await verifyWebhook(secret!, req.headers, body))
  } catch (err) {
    if (!(err instanceof WebhookSecretError)) throw err
    console.error(`sms-hook: SEND_SMS_HOOK_SECRET is malformed. ${err.message}. Set it again, in quotes.`)
    return hookError(500, 'Login codes are not set up correctly yet.')
  }
  if (!signed) {
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
  const to = `+${phone.replace(/^\+/, '')}` // Auth stores the phone without '+'

  const senders: Partial<Record<OtpChannel, () => Promise<string>>> = {
    whatsapp: deps.whatsapp ? () => deps.sendWhatsApp(deps.whatsapp!, to, loginCodeTemplate(otp)) : undefined,
    sms: deps.termii ? () => deps.sendSms(deps.termii!, to, otpMessage(otp)) : undefined,
  }
  const usable = deps.channels.filter((c) => senders[c])
  if (usable.length === 0) {
    console.error('sms-hook: no channel set up (WhatsApp or Termii)')
    return hookError(500, 'Login codes cannot be sent yet. Please try again later.')
  }

  for (const channel of usable) {
    try {
      await senders[channel]!()
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    } catch (err) {
      // Never log the code itself.
      console.error(`sms-hook: ${channel} send failed`, err instanceof Error ? err.message : err)
    }
  }
  return hookError(502, 'Could not send your code. Please try again shortly.')
}

if (import.meta.main) Deno.serve((req) => handleSmsHook(req))
