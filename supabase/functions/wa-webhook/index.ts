// WhatsApp webhook (Meta Cloud API): tenants chat with RentPadi to check rent, pay and get receipts.
//
// GET  — Meta's one-time verification (hub.challenge), using WHATSAPP_VERIFY_TOKEN.
// POST — messages and delivery statuses, signed with the Meta app secret (WHATSAPP_APP_SECRET).
// Always answers 200 to signed requests, otherwise Meta keeps retrying.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0'
import { startCheckout } from '../_shared/checkout.ts'
import { UserError } from '../_shared/http.ts'
import { receiptFileName, receiptPdf, type Receipt } from '../_shared/receipt-pdf.ts'
import { adminClient } from '../_shared/supabase.ts'
import { botReply, type BotDeps, type Portal, type Tenancy } from '../_shared/wa-bot.ts'
import {
  documentMessage,
  parseWebhook,
  sendWhatsApp,
  uploadMedia,
  verifyWebhookSignature,
  whatsappConfigFromEnv,
  type Inbound,
  type OutboundMessage,
  type WhatsAppConfig,
} from '../_shared/whatsapp.ts'

export type WebhookDeps = {
  verifyToken: string | undefined
  appSecret: string | undefined
  /** Handle one message; returns false if it was a duplicate (already handled). */
  handleMessage: (msg: Inbound) => Promise<boolean>
  handleStatus: (status: { id: string; status: string; error?: string }) => Promise<void>
}

export async function handleWaWebhook(req: Request, deps: WebhookDeps): Promise<Response> {
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const ok =
      url.searchParams.get('hub.mode') === 'subscribe' &&
      Boolean(deps.verifyToken) &&
      url.searchParams.get('hub.verify_token') === deps.verifyToken
    return ok ? new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 }) : new Response('Forbidden', { status: 403 })
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const raw = await req.text()
  if (!deps.appSecret || !(await verifyWebhookSignature(deps.appSecret, raw, req.headers.get('x-hub-signature-256')))) {
    console.warn('wa-webhook: rejected unsigned or badly signed request')
    return new Response('Invalid signature', { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response('ok', { status: 200 }) // nothing we can do with it; don't make Meta retry
  }

  const { messages, statuses } = parseWebhook(payload)
  for (const s of statuses) {
    try {
      await deps.handleStatus(s)
    } catch (err) {
      console.error('wa-webhook: status update failed', err)
    }
  }
  for (const m of messages) {
    try {
      await deps.handleMessage(m)
    } catch (err) {
      console.error('wa-webhook: message handling failed', err)
    }
  }
  return new Response('ok', { status: 200 })
}

// ─────────────────────────── real dependencies ───────────────────────────

function botDeps(admin: SupabaseClient, wa: WhatsAppConfig, appUrl: string): BotDeps {
  return {
    tenancies: async (phone) => {
      const { data, error } = await admin.rpc('wa_tenancies', { p_phone: phone })
      if (error) throw error
      return (data ?? []) as Tenancy[]
    },
    portal: async (token) => {
      const { data, error } = await admin.rpc('tenant_portal', { p_token: token })
      if (error) throw error
      return (data as Portal | null) ?? null
    },
    checkout: async (token, chargeId) => {
      try {
        return await startCheckout(admin, token, chargeId)
      } catch (err) {
        if (err instanceof UserError) throw err // tenant-safe message
        console.error('wa-webhook: checkout failed', err)
        throw new Error('Sorry, we couldn’t start the payment. Please try again in a minute.')
      }
    },
    receiptDocument: async (receiptToken) => {
      const { data, error } = await admin.rpc('receipt', { p_token: receiptToken })
      if (error) throw error
      const r = data as Receipt | null
      if (!r) return null
      const filename = receiptFileName(r)
      const mediaId = await uploadMedia(wa, receiptPdf(r, `${appUrl}/r/${receiptToken}`), filename, 'application/pdf')
      return documentMessage(mediaId, filename, `Receipt ${r.receipt_number}${r.voided ? ' (VOID)' : ''}`)
    },
  }
}

if (import.meta.main) {
  const admin = adminClient()
  const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '')

  Deno.serve((req) =>
    handleWaWebhook(req, {
      verifyToken: Deno.env.get('WHATSAPP_VERIFY_TOKEN'),
      appSecret: Deno.env.get('WHATSAPP_APP_SECRET'),

      handleMessage: async (msg) => {
        // Meta can deliver the same message more than once: answer it only the first time.
        const { data: fresh, error } = await admin
          .from('wa_inbound')
          .upsert({ message_id: msg.id, from_phone: msg.from }, { onConflict: 'message_id', ignoreDuplicates: true })
          .select('message_id')
        if (error) throw error
        if (!fresh?.length) return false

        const wa = whatsappConfigFromEnv()
        if (!wa) throw new Error('WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID not set')
        const replies: OutboundMessage[] = await botReply(msg, botDeps(admin, wa, appUrl))
        for (const reply of replies) await sendWhatsApp(wa, msg.from, reply)
        return true
      },

      handleStatus: async ({ id, status, error }) => {
        // Reminders/receipts we sent: record failures (e.g. number not on WhatsApp).
        if (status !== 'failed') return
        const { error: dbError } = await admin
          .from('reminders')
          .update({ status: 'failed', error: error ?? 'WhatsApp could not deliver this message' })
          .eq('provider_message_id', id)
        if (dbError) throw dbError
      },
    }),
  )
}
