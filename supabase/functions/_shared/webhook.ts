// Standard Webhooks signature check (https://www.standardwebhooks.com), used by Supabase Auth hooks.
// Secret format from the dashboard: "v1,whsec_<base64>".

const TOLERANCE_SECONDS = 5 * 60

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

function bytesToBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export class WebhookSecretError extends Error {}

/**
 * The key bytes from a dashboard secret. Forgiving about how it was pasted: surrounding quotes or
 * spaces, "v1 whsec_…" (PowerShell turns an unquoted comma into a space), or a bare "whsec_…".
 */
export function secretKeyBytes(secret: string): Uint8Array<ArrayBuffer> {
  const b64 = secret
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim()
    .replace(/^v1[,\s]+/, '')
    .replace(/^whsec_/, '')
  try {
    if (!b64) throw new Error('empty')
    return base64ToBytes(b64)
  } catch {
    throw new WebhookSecretError('Hook secret is not in the "v1,whsec_<base64>" format from the dashboard')
  }
}

export async function signWebhook(secret: string, id: string, timestamp: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    secretKeyBytes(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`))
  return `v1,${bytesToBase64(mac)}`
}

/** True when the request was signed with `secret` within the last 5 minutes. */
export async function verifyWebhook(
  secret: string,
  headers: Headers,
  body: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const id = headers.get('webhook-id')
  const timestamp = headers.get('webhook-timestamp')
  const signatures = headers.get('webhook-signature')
  if (!id || !timestamp || !signatures) return false
  if (Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS) return false

  // Several secrets may be configured, separated by "|" (e.g. while rotating).
  for (const one of secret.split('|')) {
    const expected = await signWebhook(one, id, timestamp, body)
    if (signatures.split(' ').some((sig) => timingSafeEqual(sig, expected))) return true
  }
  return false
}
