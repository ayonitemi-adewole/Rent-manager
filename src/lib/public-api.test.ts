import { afterEach, describe, expect, it, vi } from 'vitest'
import { friendlyError } from './errors'
import { publicFunction, publicRpc } from './public-api'

const respond = (status: number, body: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status })))

afterEach(() => vi.unstubAllGlobals())

describe('publicRpc', () => {
  it('returns the function result', async () => {
    respond(200, { tenant_name: 'Ada' })
    await expect(publicRpc('tenant_portal', { p_token: 'x' })).resolves.toEqual({ tenant_name: 'Ada' })
  })
  it('returns null for an unknown link', async () => {
    respond(200, null)
    await expect(publicRpc('receipt', { p_token: 'x' })).resolves.toBeNull()
  })
  it('keeps the Postgres error code and message', async () => {
    respond(400, { code: 'P0001', message: 'Record the earlier rent first.' })
    const err = await publicRpc('x', {}).catch((e: unknown) => e)
    expect(err).toMatchObject({ code: 'P0001', message: 'Record the earlier rent first.' })
  })
  it('explains a dropped connection', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    const err = await publicRpc('x', {}).catch((e: unknown) => e)
    expect(friendlyError(err)).toBe('No connection. Check your internet and try again.')
  })
})

describe('publicFunction', () => {
  it("surfaces our function's error message", async () => {
    respond(409, { error: 'Pay the rent due 1 Dec first.' })
    await expect(publicFunction('pay-checkout', {})).rejects.toThrow('Pay the rent due 1 Dec first.')
  })
  it('falls back to the HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('oops', { status: 502 })))
    await expect(publicFunction('pay-verify', {})).rejects.toThrow('HTTP 502')
  })
})
