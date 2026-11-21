import { CheckCircle2, FlaskConical, Loader2, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Callout } from '@/components/Callout'
import { Field, FormError, FormSection } from '@/components/Field'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useLandlord } from '@/features/landlord/api'
import { env } from '@/lib/env'
import { friendlyError } from '@/lib/errors'
import { useBanks, useResolvedAccount, useSavePayout, type Bank } from './api'

// Shown first in the picker: where most landlords and tenants bank.
const POPULAR = [
  'access bank', 'guaranty trust', 'first bank', 'united bank for africa', 'zenith bank', 'opay', 'moniepoint',
  'palmpay', 'kuda', 'wema bank', 'fidelity bank', 'first city monument', 'sterling bank', 'union bank',
  'stanbic', 'ecobank', 'polaris', 'keystone',
]

export function PayoutPage() {
  const navigate = useNavigate()
  const { data: landlord } = useLandlord()
  const banks = useBanks()
  const save = useSavePayout()

  const [bankCode, setBankCode] = useState(landlord?.bank_code ?? '')
  const [accountNumber, setAccountNumber] = useState(landlord?.account_number ?? '')
  const resolved = useResolvedAccount(bankCode, accountNumber)

  const { popular, others } = useMemo(() => splitBanks(banks.data ?? []), [banks.data])
  // Re-saving the same account is allowed until it's set up on Paystack (accounts from before the switch).
  const unchanged =
    Boolean(landlord?.paystack_subaccount_code) &&
    bankCode === landlord?.bank_code &&
    accountNumber === landlord?.account_number

  return (
    <>
      <PageHeader
        title="Payout account"
        subtitle="Where tenants’ rent is paid."
        back={{ to: '/settings', label: 'Settings' }}
      />

      <Callout icon={ShieldCheck} title="RentPadi never holds your money" className="mb-4">
        Rent goes straight from your tenant to this account through Paystack. Paystack’s fee comes out of each
        payment; tenants pay exactly the rent.
      </Callout>

      {env.paystackPublicKey?.startsWith('pk_test_') && (
        <Callout tone="info" icon={FlaskConical} className="mb-4 text-xs">
          <strong>Test mode:</strong> no real money moves. Paystack still checks the account name with the bank,
          and limits how many lookups a test account can make each day.
        </Callout>
      )}

      <QueryState isPending={banks.isPending} error={banks.error} refetch={banks.refetch} />

      {banks.data && (
        <form
          data-tour="payout-form"
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            if (!resolved.data) return
            save.mutate(
              { bankCode, accountNumber, resolved: resolved.data },
              { onSuccess: () => navigate('/settings', { replace: true }) },
            )
          }}
        >
          <FormSection>
            <Field id="bank" label="Bank">
              <NativeSelect id="bank" value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
                <option value="">Choose your bank…</option>
                <optgroup label="Popular">
                  {popular.map((b) => (
                    <option key={`${b.code}-${b.name}`} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="All banks">
                  {others.map((b) => (
                    <option key={`${b.code}-${b.name}`} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
              </NativeSelect>
            </Field>

            <Field id="accountNumber" label="Account number">
              <Input
                id="accountNumber"
                inputMode="numeric"
                autoComplete="off"
                maxLength={10}
                placeholder="0123456789"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                className="figure h-12 text-lg tracking-[0.15em] md:text-lg"
              />
            </Field>
          </FormSection>

          {resolved.isFetching && (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> Checking account…
            </p>
          )}
          {resolved.data && !resolved.isFetching && (
            <Callout tone="success" icon={CheckCircle2} title={resolved.data.account_name} className="motion-safe:animate-enter">
              Is this your account? Rent will be paid to this name.
            </Callout>
          )}
          <FormError message={resolved.error ? friendlyError(resolved.error) : null} />
          <FormError message={save.error ? friendlyError(save.error) : null} />

          <Button
            type="submit"
            className="h-12 w-full text-base"
            disabled={!resolved.data || resolved.isFetching || save.isPending || unchanged}
          >
            {save.isPending ? 'Saving…' : 'Yes, use this account'}
          </Button>
        </form>
      )}
    </>
  )
}

function splitBanks(banks: Bank[]) {
  const isPopular = (b: Bank) => POPULAR.some((p) => b.name.toLowerCase().includes(p))
  return { popular: banks.filter(isPopular), others: banks.filter((b) => !isPopular(b)) }
}
