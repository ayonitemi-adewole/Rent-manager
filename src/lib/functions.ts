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
      const payload = (await error.context.json().catch(() => null)) as { error?: string } | null
      throw new Error(payload?.error ?? 'Something went wrong. Please try again.')
    }
    throw new Error('No connection. Check your internet and try again.')
  }
  return data as T
}
