import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

/**
 * Call an edge function. On failure, throws an Error carrying the function's own
 * `{ error }` message (our functions only put user-safe text there).
 */
export async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      // Our functions send { error }; the Supabase gateway sends { msg } or { message }.
      const payload = (await error.context.json().catch(() => null)) as
        | { error?: string; msg?: string; message?: string }
        | null
      const status = (error.context as Response).status
      throw new Error(
        payload?.error ?? payload?.msg ?? payload?.message ?? `Something went wrong (HTTP ${status}). Please try again.`,
      )
    }
    throw new Error('No connection. Check your internet and try again.')
  }
  return data as T
}
