// Shared by the payout edge function and the app (src/features/payout), so both agree on when a
// WhatsApp code is needed. Plain TypeScript: no Deno or browser APIs.

type OnFile = { bank_code: string | null; account_number: string | null }

/**
 * True when saving this account needs a code sent to the landlord's WhatsApp: setting one up for
 * the first time, or replacing the one on file. Re-confirming the account already on file (e.g.
 * after the move to Paystack) doesn't, as where rent goes stays the same.
 */
export function needsPayoutCode(onFile: OnFile | null | undefined, bankCode: string, accountNumber: string): boolean {
  if (!onFile?.account_number) return true
  return onFile.bank_code !== bankCode || onFile.account_number !== accountNumber
}
