// WhatsApp Cloud API (Meta) client: send messages, upload documents, verify webhooks.
// https://developers.facebook.com/docs/whatsapp/cloud-api

export type WhatsAppConfig = {
  token: string
  phoneNumberId: string
  apiVersion: string
}

/** null when WhatsApp isn't set up yet (the sender then leaves WhatsApp messages queued). */
export function whatsappConfigFromEnv(): WhatsAppConfig | null {
  const token = Deno.env.get('WHATSAPP_TOKEN')
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID')
  if (!token || !phoneNumberId) return null
  return { token, phoneNumberId, apiVersion: Deno.env.get('WHATSAPP_API_VERSION') ?? 'v23.0' }
}

export class WhatsAppError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message)
  }
}

const base = (c: WhatsAppConfig) => `https://graph.facebook.com/${c.apiVersion}/${c.phoneNumberId}`

async function graph(c: WhatsAppConfig, path: string, init: RequestInit, fetchFn: typeof fetch) {
  const res = await fetchFn(`${base(c)}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${c.token}`, ...(init.headers ?? {}) },
  })
  const body = (await res.json().catch(() => null)) as
    | { messages?: { id: string }[]; id?: string; error?: { message?: string; code?: number } }
    | null
  if (!res.ok) throw new WhatsAppError(`WhatsApp ${res.status}: ${body?.error?.message ?? 'request failed'}`, body?.error?.code)
  return body ?? {}
}

// ─────────────────────────── messages ───────────────────────────

/** The `message` part of a send request (everything except recipient). */
export type OutboundMessage = Record<string, unknown> & { type: string }

/** Send to an E.164 number. Returns WhatsApp's message id. */
export async function sendWhatsApp(
  c: WhatsAppConfig,
  to: string,
  message: OutboundMessage,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const body = await graph(
    c,
    '/messages',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: to.replace(/^\+/, ''), ...message }),
    },
    fetchFn,
  )
  const id = body.messages?.[0]?.id
  if (!id) throw new WhatsAppError('WhatsApp returned no message id')
  return id
}

/** Upload a file (e.g. a receipt PDF) and return its media id, valid for 30 days. */
export async function uploadMedia(
  c: WhatsAppConfig,
  bytes: Uint8Array,
  filename: string,
  mimeType: string,
  fetchFn: typeof fetch = fetch,
): Promise<string> {
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', mimeType)
  form.append('file', new Blob([bytes as BlobPart], { type: mimeType }), filename)
  const body = await graph(c, '/media', { method: 'POST', body: form }, fetchFn)
  if (!body.id) throw new WhatsAppError('WhatsApp returned no media id')
  return body.id
}

// Meta's length limits; longer text is rejected, so trim.
const cut = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`)

export const text = (body: string): OutboundMessage => ({ type: 'text', text: { body: cut(body, 4096), preview_url: false } })

/** Up to 3 reply buttons. */
export function buttons(body: string, items: { id: string; title: string }[]): OutboundMessage {
  return {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: cut(body, 1024) },
      action: {
        buttons: items.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: cut(b.id, 256), title: cut(b.title, 20) } })),
      },
    },
  }
}

/** A tap-to-open list of up to 10 rows. */
export function list(
  body: string,
  buttonLabel: string,
  rows: { id: string; title: string; description?: string }[],
): OutboundMessage {
  return {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: cut(body, 1024) },
      action: {
        button: cut(buttonLabel, 20),
        sections: [
          {
            title: cut(buttonLabel, 24),
            rows: rows.slice(0, 10).map((r) => ({
              id: cut(r.id, 200),
              title: cut(r.title, 24),
              ...(r.description ? { description: cut(r.description, 72) } : {}),
            })),
          },
        ],
      },
    },
  }
}

/** A message with one button that opens a web link (e.g. the Paystack checkout). */
export function linkButton(body: string, label: string, url: string): OutboundMessage {
  return {
    type: 'interactive',
    interactive: {
      type: 'cta_url',
      body: { text: cut(body, 1024) },
      action: { name: 'cta_url', parameters: { display_text: cut(label, 20), url } },
    },
  }
}

export const documentMessage = (mediaId: string, filename: string, caption: string): OutboundMessage => ({
  type: 'document',
  document: { id: mediaId, filename, caption: cut(caption, 1024) },
})

// ─────────────────────────── webhooks ───────────────────────────

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Meta signs each webhook with the app secret: X-Hub-Signature-256: sha256=<hex HMAC of the raw body>. */
export async function signWebhookBody(appSecret: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return `sha256=${toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)))}`
}

export async function verifyWebhookSignature(appSecret: string, rawBody: string, header: string | null): Promise<boolean> {
  if (!header) return false
  const expected = await signWebhookBody(appSecret, rawBody)
  if (expected.length !== header.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i)
  return diff === 0
}

/** What the bot needs from one incoming message. */
export type Inbound = {
  id: string
  /** E.164, e.g. "+2348031234567". */
  from: string
  /** Typed text, or the id of the tapped button / list row. */
  text: string
  /** True when `text` is a button or list id we sent. */
  isReply: boolean
}

type WebhookValue = {
  messages?: {
    id: string
    from: string
    type: string
    text?: { body: string }
    interactive?: { button_reply?: { id: string }; list_reply?: { id: string } }
    button?: { payload?: string; text?: string }
  }[]
  statuses?: { id: string; status: string; errors?: { code?: number; title?: string; message?: string }[] }[]
}

/** Pull messages and delivery statuses out of a webhook payload. */
export function parseWebhook(payload: unknown): {
  messages: Inbound[]
  statuses: { id: string; status: string; error?: string }[]
} {
  const messages: Inbound[] = []
  const statuses: { id: string; status: string; error?: string }[] = []
  const entries = (payload as { entry?: { changes?: { value?: WebhookValue }[] }[] })?.entry ?? []
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {}
      for (const m of value.messages ?? []) {
        // Without a phone number we can't find the tenant (e.g. Meta's username-only senders): skip it
        // rather than failing the whole delivery, which would make Meta retry it forever.
        if (!m?.id || typeof m.from !== 'string' || !m.from) continue
        const reply = m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id
        // Quick-reply buttons on templates arrive as type "button".
        const templateButton = m.button?.payload ?? m.button?.text
        messages.push({
          id: m.id,
          from: `+${m.from.replace(/^\+/, '')}`,
          text: reply ?? templateButton ?? m.text?.body ?? '',
          isReply: Boolean(reply),
        })
      }
      for (const s of value.statuses ?? []) {
        if (!s?.id) continue
        const err = s.errors?.[0]
        const error = err ? `${err.code ? `(#${err.code}) ` : ''}${err.message ?? err.title ?? 'failed'}` : undefined
        statuses.push({ id: s.id, status: s.status, error })
      }
    }
  }
  return { messages, statuses }
}
