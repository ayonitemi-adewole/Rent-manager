// Delivers queued reminders and receipts. Called every 5 minutes by pg_cron (run_message_sender),
// with the shared secret MESSAGE_SENDER_SECRET in the x-sender-secret header.
//
// WhatsApp messages go out once WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID are set; SMS once
// TERMII_API_KEY + TERMII_SENDER_ID are set. Until then those rows simply stay queued.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0'
import { reportError } from '../_shared/monitoring.ts'
import { receiptFileName, receiptPdf, type Receipt } from '../_shared/receipt-pdf.ts'
import { adminClient } from '../_shared/supabase.ts'
import { sendSms, termiiConfigFromEnv } from '../_shared/termii.ts'
import { receiptTemplate, reminderTemplate, type OutboundRow } from '../_shared/wa-templates.ts'
import { sendWhatsApp, uploadMedia, whatsappConfigFromEnv, type WhatsAppConfig } from '../_shared/whatsapp.ts'

export type Senders = {
  sms?: (row: OutboundRow) => Promise<string>
  whatsapp?: (row: OutboundRow) => Promise<string>
}

export type SendDeps = {
  secret: string | undefined
  senders: Senders
  claim: (channels: string[]) => Promise<OutboundRow[]>
  markSent: (id: string, providerMessageId: string) => Promise<void>
  markFailed: (id: string, error: string) => Promise<void>
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export async function handleSend(req: Request, deps: SendDeps): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!deps.secret || req.headers.get('x-sender-secret') !== deps.secret) return json({ error: 'Unauthorized' }, 401)

  const channels = (['sms', 'whatsapp'] as const).filter((c) => deps.senders[c])
  if (channels.length === 0) return json({ sent: 0, failed: 0, note: 'No SMS or WhatsApp sender configured yet' })

  const rows = await deps.claim(channels)
  let sent = 0
  let failed = 0
  for (const row of rows) {
    try {
      const providerId = await deps.senders[row.channel]!(row)
      await deps.markSent(row.id, providerId)
      sent++
    } catch (err) {
      failed++
      const message = err instanceof Error ? err.message : String(err)
      console.error(`send-reminders: ${row.channel} ${row.kind} ${row.id} failed: ${message}`)
      await reportError('send-reminders', err, { channel: row.channel, kind: row.kind, reminder_id: row.id })
      await deps.markFailed(row.id, message.slice(0, 500))
    }
  }
  return json({ sent, failed })
}

// ─────────────────────────── real dependencies ───────────────────────────

function whatsappSender(admin: SupabaseClient, wa: WhatsAppConfig, appUrl: string) {
  return async (row: OutboundRow) => {
    if (row.kind !== 'receipt') return sendWhatsApp(wa, row.to_phone, reminderTemplate(row, appUrl))

    const { data, error } = await admin.rpc('receipt', { p_token: row.receipt_token })
    if (error) throw error
    const r = data as Receipt | null
    if (!r) throw new Error('Receipt not found')
    const filename = receiptFileName(r)
    const mediaId = await uploadMedia(wa, receiptPdf(r, `${appUrl}/r/${row.receipt_token}`), filename, 'application/pdf')
    return sendWhatsApp(wa, row.to_phone, receiptTemplate(row, mediaId, filename))
  }
}

if (import.meta.main) {
  const admin = adminClient()
  const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '')
  const wa = whatsappConfigFromEnv()
  const termii = termiiConfigFromEnv()

  Deno.serve((req) =>
    handleSend(req, {
      secret: Deno.env.get('MESSAGE_SENDER_SECRET'),
      senders: {
        whatsapp: wa ? whatsappSender(admin, wa, appUrl) : undefined,
        sms: termii ? (row) => sendSms(termii, row.to_phone, row.message) : undefined,
      },
      claim: async (channels) => {
        const { data, error } = await admin.rpc('claim_outbound_messages', { p_channels: channels, p_limit: 50 })
        if (error) throw error
        return (data ?? []) as OutboundRow[]
      },
      markSent: async (id, providerMessageId) => {
        const { error } = await admin
          .from('reminders')
          .update({ status: 'sent', provider_message_id: providerMessageId, sent_at: new Date().toISOString(), error: null })
          .eq('id', id)
        if (error) throw error
      },
      markFailed: async (id, message) => {
        const { error } = await admin.from('reminders').update({ status: 'failed', error: message }).eq('id', id)
        if (error) throw error
      },
    }),
  )
}
