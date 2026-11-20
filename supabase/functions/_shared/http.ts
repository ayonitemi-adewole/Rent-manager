// Shared HTTP helpers for edge functions.
import { functionName, reportError } from './monitoring.ts'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** An error whose message is safe to show the user. Anything else becomes a generic 500. */
export class UserError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message)
  }
}

/** Wrap a handler with CORS preflight, POST-only and error → JSON handling. */
export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    try {
      return await fn(req)
    } catch (err) {
      if (err instanceof UserError) return json({ error: err.message }, err.status)
      console.error(err)
      await reportError(functionName(req), err)
      return json({ error: 'Something went wrong. Please try again.' }, 500)
    }
  }
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new UserError('Invalid request body')
  }
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}
