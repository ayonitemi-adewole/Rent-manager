import { CheckCircle2, Loader2, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Field, FormError } from '@/components/Field'
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
  const unchanged = bankCode === landlord?.bank_code && accountNumber === landlord?.account_number

  return (
    <>
      <PageHeader
        title="Payout account"
        subtitle="Where tenants’ rent is paid."
        back={{ to: '/settings', label: 'Settings' }}
      />

      <div className="bg-secondary text-secondary-foreground mb-5 flex gap-3 rounded-lg p-3 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" />
        <p>
          Rent goes straight from your tenant to this account through Flutterwave. RentPadi never holds your
          money.
        </p>
      </div>

      {env.flwPublicKey?.includes('TEST') && (
        <p className="text-muted-foreground mb-4 rounded-lg border border-dashed p-3 text-xs">
          <strong>Test mode:</strong> Flutterwave can usually only look up its test accounts. Use{' '}
          <strong>Access Bank</strong> and account number <strong>0690000031</strong>.
        </p>
      )}

      <QueryState isPending={banks.isPending} error={banks.error} refetch={banks.refetch} />

      {banks.data && (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate({ bankCode, accountNumber }, { onSuccess: () => navigate('/settings', { replace: true }) })
          }}
        >
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
              className="h-12 text-base tracking-wider"
            />
          </Field>

          {resolved.isFetching && (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> Checking account…
            </p>
          )}
          {resolved.data && !resolved.isFetching && (
            <div className="border-success/30 bg-success/10 flex items-start gap-3 rounded-lg border p-3">
              <CheckCircle2 className="text-success mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-semibold">{resolved.data}</p>
                <p className="text-muted-foreground text-xs">Is this your account? Rent will be paid to this name.</p>
              </div>
            </div>
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
