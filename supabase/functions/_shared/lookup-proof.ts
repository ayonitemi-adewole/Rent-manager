// Proof that the payout function looked an account up with Paystack a moment ago.
//
// Saving a payout account must store the name the bank gave, not one typed in the browser. Looking
// the account up again on save did that, but cost a second Paystack lookup, and Paystack limits
// lookups (tightly in test mode). Instead the lookup returns this signed, short-lived proof, and
// save accepts the name only if the proof matches this landlord, bank, account and name.

/** How long a lookup stays usable for saving. */
export const LOOKUP_TTL_SECONDS = 30 * 60

export type Lookup = { userId: string; bankCode: string; accountNumber: string; accountName: string }

async function mac(secret: string, lookup: Lookup, expires: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  // Labelled, so a signature made here can't be passed off as any other kind of signature.
  const message = JSON.stringify([
    'rentpadi-payout-lookup-v1',
    lookup.userId,
    lookup.bankCode,
    lookup.accountNumber,
    lookup.accountName,
    expires,
  ])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)))
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** "<expires>.<signature>", to send back to the browser with the account name. */
export async function signLookup(secret: string, lookup: Lookup, nowSeconds = Math.floor(Date.now() / 1000)) {
  const expires = nowSeconds + LOOKUP_TTL_SECONDS
  return `${expires}.${await mac(secret, lookup, expires)}`
}

/** True when `proof` was made by signLookup for exactly this lookup and hasn't expired. */
export async function verifyLookup(
  secret: string,
  lookup: Lookup,
  proof: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  const match = /^(\d{1,12})\.([0-9a-f]{64})$/.exec(proof)
  if (!match) return false
  const expires = Number(match[1])
  if (expires < nowSeconds || expires > nowSeconds + LOOKUP_TTL_SECONDS) return false
  const expected = await mac(secret, lookup, expires)
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ match[2].charCodeAt(i)
  return diff === 0
}
