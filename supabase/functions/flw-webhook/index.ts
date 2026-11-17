// Flutterwave webhook. Configure in Flutterwave dashboard → Settings → Webhooks:
//   URL:        https://<project-ref>.supabase.co/functions/v1/flw-webhook
//   Secret hash: same value as the FLW_WEBHOOK_HASH secret
//
// 1. Check the verif-hash header.  2. Log the raw event.  3. Re-verify with Flutterwave.
// 4. Record via settleTransaction (idempotent, so Flutterwave retries are harmless).
import { verifyTransaction } from '../_shared/flutterwave.ts'
import { requireEnv } from '../_shared/http.ts'
import { settleTransaction } from '../_shared/settle.ts'
import { adminClient } from '../_shared/supabase.ts'

type WebhookBody = { event?: string; data?: { id?: number; tx_ref?: string } }

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const signature = req.headers.get('verif-hash') ?? ''
  if (!timingSafeEqual(signature, requireEnv('FLW_WEBHOOK_HASH'))) {
    return new Response('Unauthorized', { status: 401 })
  }

  let body: WebhookBody
  try {
    body = await req.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  const admin = adminClient()
  const { data: logged, error: logError } = await admin
    .from('webhook_events')
    .insert({
      provider: 'flutterwave',
      event_type: body.event ?? null,
      external_id: body.data?.id != null ? String(body.data.id) : null,
      payload: body,
    })
    .select('id')
    .single()
  if (logError) {
    console.error(logError)
    return new Response('Error', { status: 500 }) // Flutterwave will retry
  }

  try {
    let outcome = 'ignored'
    if (body.event === 'charge.completed' && typeof body.data?.id === 'number') {
      const tx = await verifyTransaction(body.data.id)
      outcome = (await settleTransaction(admin, tx)).outcome
    }
    await admin
      .from('webhook_events')
      .update({ processed_at: new Date().toISOString(), error: outcome === 'ignored' ? 'ignored' : null })
      .eq('id', logged.id)
    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error(err)
    await admin.from('webhook_events').update({ error: String(err) }).eq('id', logged.id)
    return new Response('Error', { status: 500 }) // Flutterwave will retry
  }
})

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const x = enc.encode(a)
  const y = enc.encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}
