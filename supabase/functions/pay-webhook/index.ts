// Paystack webhook. Set it in the Paystack dashboard → Settings → API Keys & Webhooks:
//   Webhook URL: https://<project-ref>.supabase.co/functions/v1/pay-webhook
// Paystack signs every call with the secret key (x-paystack-signature); nothing else to configure.
//
// 1. Check the signature.  2. Log the raw event.  3. Re-verify with Paystack.
// 4. Record via settleTransaction (idempotent, so Paystack's retries are harmless).
import { requireEnv } from '../_shared/http.ts'
import { isValidSignature, verifyTransaction } from '../_shared/paystack.ts'
import { settleTransaction } from '../_shared/settle.ts'
import { adminClient } from '../_shared/supabase.ts'

type WebhookBody = { event?: string; data?: { reference?: string } }

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const admin = adminClient()
  const raw = await req.text()
  const signature = req.headers.get('x-paystack-signature') ?? ''

  if (!(await isValidSignature(raw, signature, requireEnv('PAYSTACK_SECRET_KEY')))) {
    // Log rejected calls (never processed) so a key mismatch is visible, not silent.
    // Only a small, capped payload is kept since anyone can call this URL.
    await admin.from('webhook_events').insert({
      provider: 'paystack',
      event_type: null,
      external_id: null,
      payload: { raw: raw.slice(0, 2000), had_signature: signature !== '' },
      error: signature ? 'invalid x-paystack-signature' : 'missing x-paystack-signature',
    })
    return new Response('Unauthorized', { status: 401 })
  }

  let body: WebhookBody
  try {
    body = JSON.parse(raw)
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  const reference = body.event === 'charge.success' ? (body.data?.reference ?? null) : null

  const { data: logged, error: logError } = await admin
    .from('webhook_events')
    .insert({ provider: 'paystack', event_type: body.event ?? null, external_id: reference, payload: body })
    .select('id')
    .single()
  if (logError) {
    console.error(logError)
    return new Response('Error', { status: 500 }) // Paystack will retry
  }

  try {
    let outcome = 'ignored'
    if (reference) {
      const tx = await verifyTransaction(reference)
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
    return new Response('Error', { status: 500 }) // Paystack will retry
  }
})
