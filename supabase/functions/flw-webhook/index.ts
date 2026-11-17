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

// Flutterwave sends one of two shapes, depending on the dashboard's "v3 webhooks" setting:
//   v3:     { event: 'charge.completed', data: { id, tx_ref, status, ... } }
//   legacy: { id, txRef, status, ... }   (no event field)
// Either way we only take the transaction id from it and re-verify with Flutterwave.
type WebhookBody = {
  event?: string
  data?: { id?: number; tx_ref?: string }
  id?: number
  txRef?: string
}

function transactionIdOf(body: WebhookBody): number | null {
  if (body.event) {
    return body.event === 'charge.completed' && typeof body.data?.id === 'number' ? body.data.id : null
  }
  return typeof body.id === 'number' && typeof body.txRef === 'string' ? body.id : null
}

/** The stored secret, ignoring surrounding whitespace or quotes left by copy-paste. */
function expectedHash(): string {
  return requireEnv('FLW_WEBHOOK_HASH').trim().replace(/^(['"])(.*)\1$/, '$2')
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const admin = adminClient()
  const signature = req.headers.get('verif-hash') ?? ''
  if (!timingSafeEqual(signature.trim(), expectedHash())) {
    // Log rejected calls (never processed) so a hash mismatch is visible, not silent.
    // Only a small, capped payload is kept since anyone can call this URL.
    const raw = (await req.text().catch(() => '')).slice(0, 2000)
    await admin.from('webhook_events').insert({
      provider: 'flutterwave',
      event_type: null,
      external_id: null,
      payload: { raw, had_signature: signature !== '' },
      error: signature ? 'invalid verif-hash' : 'missing verif-hash',
    })
    return new Response('Unauthorized', { status: 401 })
  }

  let body: WebhookBody
  try {
    body = await req.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  const { data: logged, error: logError } = await admin
    .from('webhook_events')
    .insert({
      provider: 'flutterwave',
      event_type: body.event ?? 'legacy',
      external_id: transactionIdOf(body)?.toString() ?? null,
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
    const transactionId = transactionIdOf(body)
    if (transactionId !== null) {
      const tx = await verifyTransaction(transactionId)
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
