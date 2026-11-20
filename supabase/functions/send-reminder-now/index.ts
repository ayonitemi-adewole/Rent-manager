// Landlord taps "Send from RentPadi's WhatsApp": send a rent reminder to one tenant right now,
// as the approved reminder template, from RentPadi's WhatsApp number. Body: { tenant_id }
//
// Signed-in landlords only. The reminder is recorded in public.reminders (kind 'manual'), so it
// shows in the tenant's reminder list; prepare_manual_reminder checks ownership, what's owed and
// the once-per-12-hours limit.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.119.0'
import { handler, json, readJson, UserError } from '../_shared/http.ts'
import { reportError } from '../_shared/monitoring.ts'
import { adminClient, requireUser } from '../_shared/supabase.ts'
import { reminderTemplate, type OutboundRow } from '../_shared/wa-templates.ts'
import { sendWhatsApp, whatsappConfigFromEnv, WhatsAppError } from '../_shared/whatsapp.ts'

export type SendNowDeps = {
  userId: (req: Request) => Promise<string>
  /** null when WhatsApp isn't set up on the server. */
  send: ((row: OutboundRow) => Promise<string>) | null
  prepare: (landlordId: string, tenantId: string) => Promise<OutboundRow>
  markSent: (id: string, providerMessageId: string) => Promise<void>
  markFailed: (id: string, error: string) => Promise<void>
}

/** Meta's errors, in words a landlord can act on. */
export function friendlyWhatsAppError(err: unknown): string {
  const code = err instanceof WhatsAppError ? err.code : undefined
  switch (code) {
    case 131030:
      return 'RentPadi’s WhatsApp is still in test mode and can’t message this number yet.'
    case 131026:
      return 'This number can’t receive WhatsApp messages. Check the tenant’s WhatsApp number.'
    case 132000:
    case 132001:
      return 'The WhatsApp reminder message isn’t approved yet. Try again later.'
    case 131031:
      return 'RentPadi’s WhatsApp account is temporarily restricted. Try again later.'
    case 130429:
    case 131048:
    case 131056:
      return 'Too many WhatsApp messages just now. Try again in a few minutes.'
  }
  return 'WhatsApp couldn’t send the reminder just now. Try again in a few minutes.'
}

export async function handleSendNow(req: Request, deps: SendNowDeps): Promise<Response> {
  const landlordId = await deps.userId(req)
  const { tenant_id: tenantId = '' } = await readJson<{ tenant_id?: string }>(req)
  if (!tenantId) throw new UserError('Choose a tenant.')
  if (!deps.send) throw new UserError('Sending on WhatsApp isn’t set up yet.', 503)

  const row = await deps.prepare(landlordId, tenantId)
  try {
    const providerId = await deps.send(row)
    await deps.markSent(row.id, providerId)
    return json({ status: 'sent', to: row.to_phone })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`send-reminder-now: ${row.id} failed: ${message}`)
    await reportError('send-reminder-now', err, { reminder_id: row.id })
    await deps.markFailed(row.id, message.slice(0, 500))
    throw new UserError(friendlyWhatsAppError(err), 502)
  }
}

// ─────────────────────────── real dependencies ───────────────────────────

function realDeps(admin: SupabaseClient): SendNowDeps {
  const wa = whatsappConfigFromEnv()
  const appUrl = (Deno.env.get('APP_URL') ?? '').replace(/\/$/, '')
  const update = async (id: string, values: Record<string, unknown>) => {
    const { error } = await admin.from('reminders').update(values).eq('id', id)
    if (error) throw error
  }
  return {
    userId: async (req) => (await requireUser(req, admin)).id,
    send: wa ? (row) => sendWhatsApp(wa, row.to_phone, reminderTemplate(row, appUrl)) : null,
    prepare: async (landlordId, tenantId) => {
      const { data, error } = await admin.rpc('prepare_manual_reminder', {
        p_landlord_id: landlordId,
        p_tenant_id: tenantId,
      })
      // Messages raised by prepare_manual_reminder are written for the landlord.
      if (error?.code === 'P0001') throw new UserError(error.message)
      if (error) throw error
      const row = (data as OutboundRow[] | null)?.[0]
      if (!row) throw new Error('prepare_manual_reminder returned nothing')
      return row
    },
    markSent: (id, providerMessageId) =>
      update(id, {
        status: 'sent',
        provider_message_id: providerMessageId,
        sent_at: new Date().toISOString(),
        error: null,
      }),
    markFailed: (id, error) => update(id, { status: 'failed', error }),
  }
}

if (import.meta.main) {
  const admin = adminClient()
  Deno.serve(handler((req) => handleSendNow(req, realDeps(admin))))
}
