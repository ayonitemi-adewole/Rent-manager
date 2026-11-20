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

export function useSavePayout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { bankCode: string; accountNumber: string; resolved: ResolvedAccount }) =>
      invokeFunction('payout', {
        action: 'save',
        bank_code: v.bankCode,
        account_number: v.accountNumber,
        account_name: v.resolved.account_name,
        lookup: v.resolved.lookup,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: landlordKey }),
  })
}
