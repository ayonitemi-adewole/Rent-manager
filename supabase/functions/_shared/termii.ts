// Termii SMS (https://developers.termii.com/messaging-api).
// Shared by the login-code hook now and by the reminder/receipt sender later.

export type TermiiConfig = {
  apiKey: string
  senderId: string
  /** Account-specific base URL from the Termii dashboard. */
  baseUrl: string
}

/** null until Termii is set up (TERMII_API_KEY + TERMII_SENDER_ID). */
export function termiiConfigFromEnv(): TermiiConfig | null {
  const apiKey = Deno.env.get('TERMII_API_KEY')
  const senderId = Deno.env.get('TERMII_SENDER_ID')
  if (!apiKey || !senderId) return null
  return { apiKey, senderId, baseUrl: Deno.env.get('TERMII_BASE_URL') ?? 'https://v3.api.termii.com' }
}

export class TermiiError extends Error {}

/**
 * Send one SMS. `to` is E.164 (+234…). Uses the "dnd" channel, which reaches numbers on
 * Do-Not-Disturb (most Nigerian lines) and is the channel Termii requires for OTPs.
 * Returns Termii's message id.
 */
export async function sendSms(
  config: TermiiConfig,
  to: string,
  message: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchFn(`${config.baseUrl.replace(/\/$/, '')}/api/sms/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: config.apiKey,
      to: to.replace(/^\+/, ''),
      from: config.senderId,
      sms: message,
      type: 'plain',
      channel: 'dnd',
    }),
  })
  const body = (await res.json().catch(() => null)) as { message_id?: string; message?: string } | null
  if (!res.ok || !body?.message_id) {
    throw new TermiiError(`Termii ${res.status}: ${body?.message ?? 'no message id'}`)
  }
  return body.message_id
}
