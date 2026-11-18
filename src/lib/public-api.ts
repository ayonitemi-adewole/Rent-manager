import { env } from './env'

// Calls for the public tenant pages (payment link, receipt) without supabase-js,
// so tenants on slow connections don't download the login system they never use.

const NO_CONNECTION = 'No connection. Check your internet and try again.'

function headers(): HeadersInit {
  const key = env.supabaseAnonKey ?? ''
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
}

async function post(path: string, body: unknown): Promise<Response> {
  try {
    return await fetch(`${env.supabaseUrl}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) })
  } catch {
    throw new Error(NO_CONNECTION)
  }
}

type ErrorBody = { code?: string; message?: string; error?: string; msg?: string }

/** Call a database function, like supabase.rpc. Errors carry Postgres' `code` and `message`. */
export async function publicRpc<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const res = await post(`/rest/v1/rpc/${name}`, params)
  const body = (await res.json().catch(() => null)) as unknown
  if (!res.ok) {
    const e = (body ?? {}) as ErrorBody
    throw Object.assign(new Error(e.message ?? `Something went wrong (HTTP ${res.status}). Please try again.`), {
      code: e.code,
    })
  }
  return body as T
}

/** Call an edge function. Throws the function's own `{ error }` message (our functions keep it user-safe). */
export async function publicFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const res = await post(`/functions/v1/${name}`, body)
  const data = (await res.json().catch(() => null)) as unknown
  if (!res.ok) {
    const e = (data ?? {}) as ErrorBody
    throw new Error(e.error ?? e.msg ?? e.message ?? `Something went wrong (HTTP ${res.status}). Please try again.`)
  }
  return data as T
}
