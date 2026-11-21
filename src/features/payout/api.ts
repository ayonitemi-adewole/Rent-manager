import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { landlordKey } from '@/features/landlord/api'
import { invokeFunction } from '@/lib/functions'

export type Bank = { code: string; name: string }

export function useBanks() {
  return useQuery({
    queryKey: ['payout', 'banks'],
    staleTime: Infinity, // the bank list rarely changes
    queryFn: async () => (await invokeFunction<{ banks: Bank[] }>('payout', { action: 'banks' })).banks,
  })
}

export type ResolvedAccount = {
  account_name: string
  /** Signed proof of this lookup, sent back on save so the server needn't ask Paystack again. */
  lookup: string
}

/** Looks up the account holder's name once a bank and a 10-digit account number are entered. */
export function useResolvedAccount(bankCode: string, accountNumber: string) {
  const ready = bankCode !== '' && /^\d{10}$/.test(accountNumber)
  return useQuery({
    queryKey: ['payout', 'resolve', bankCode, accountNumber],
    enabled: ready,
    retry: false,
    staleTime: Infinity,
    queryFn: () =>
      invokeFunction<ResolvedAccount>('payout', {
        action: 'resolve',
        bank_code: bankCode,
        account_number: accountNumber,
      }),
  })
}

export type CodeSent = {
  /** False when no code is needed (first setup, or the same account). */
  needed: boolean
  /** 'demo': WhatsApp isn't set up, so the code is in dev_sms_outbox. */
  sent_to?: 'whatsapp' | 'demo'
  phone_last4?: string
}

/** Sends a code to the landlord's WhatsApp, needed to replace the payout account on file. */
export function useSendPayoutCode() {
  return useMutation({
    mutationFn: (v: { bankCode: string; accountNumber: string }) =>
      invokeFunction<CodeSent>('payout', {
        action: 'send_code',
        bank_code: v.bankCode,
        account_number: v.accountNumber,
      }),
  })
}

export function useSavePayout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { bankCode: string; accountNumber: string; resolved: ResolvedAccount; code?: string }) =>
      invokeFunction('payout', {
        action: 'save',
        bank_code: v.bankCode,
        account_number: v.accountNumber,
        account_name: v.resolved.account_name,
        lookup: v.resolved.lookup,
        code: v.code,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: landlordKey }),
  })
}
