// Shared by the payout edge function and the app (src/features/payout), so both agree on when a
// WhatsApp code is needed. Plain TypeScript: no Deno or browser APIs.

type OnFile = { bank_code: string | null; account_number: string | null }

/**
 * True when saving would replace a payout account already on file: that needs a code sent to the
 * landlord's WhatsApp. Setting one up for the first time, or re-confirming the same account (e.g.
 * after the move to Paystack), doesn't.
 */
export function isPayoutChange(onFile: OnFile | null | undefined, bankCode: string, accountNumber: string): boolean {
  if (!onFile?.account_number) return false
  return onFile.bank_code !== bankCode || onFile.account_number !== accountNumber
}
