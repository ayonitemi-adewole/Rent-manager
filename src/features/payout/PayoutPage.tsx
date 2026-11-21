import { CheckCircle2, FlaskConical, Loader2, MessageSquareLock, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { needsPayoutCode } from '@shared/payout-change.ts'
import { Callout } from '@/components/Callout'
import { Field, FormError, FormSection } from '@/components/Field'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { WhatsAppIcon } from '@/components/WhatsAppIcon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useLandlord } from '@/features/landlord/api'
import { env } from '@/lib/env'
import { friendlyError } from '@/lib/errors'
import { useBanks, useResolvedAccount, useSavePayout, useSendPayoutCode, type Bank } from './api'

// Shown first in the picker: where most landlords and tenants bank.
const POPULAR = [
  'access bank', 'guaranty trust', 'first bank', 'united bank for africa', 'zenith bank', 'opay', 'moniepoint',
  'palmpay', 'kuda', 'wema bank', 'fidelity bank', 'first city monument', 'sterling bank', 'union bank',
  'stanbic', 'ecobank', 'polaris', 'keystone',
]

/** Seconds before another code can be asked for (the server allows one a minute). */
const RESEND_AFTER = 60

export function PayoutPage() {
  const navigate = useNavigate()
  const { data: landlord } = useLandlord()
  const banks = useBanks()
  const save = useSavePayout()
  const sendCode = useSendPayoutCode()

  const [bankCode, setBankCode] = useState(landlord?.bank_code ?? '')
  const [accountNumber, setAccountNumber] = useState(landlord?.account_number ?? '')
  const [code, setCode] = useState('')
  const [resendIn, setResendIn] = useState(0)
  const resolved = useResolvedAccount(bankCode, accountNumber)

  useEffect(() => {
    if (resendIn <= 0) return
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [resendIn])

  const { popular, others } = useMemo(() => splitBanks(banks.data ?? []), [banks.data])
  // Re-saving the same account is allowed until it's set up on Paystack (accounts from before the switch).
  const unchanged =
    Boolean(landlord?.paystack_subaccount_code) &&
    bankCode === landlord?.bank_code &&
    accountNumber === landlord?.account_number

  // Saving a new account (the first, or a replacement) needs a code from the landlord's WhatsApp;
  // the server checks it too.
  const needsCode = needsPayoutCode(landlord, bankCode, accountNumber)
  const replacing = Boolean(landlord?.account_number)
  // A code approves one account: once the bank or number is edited, a new code is needed.
  const sent = sendCode.data
  const codeStep =
    needsCode &&
    sendCode.isSuccess &&
    sent?.needed === true &&
    sendCode.variables.bankCode === bankCode &&
    sendCode.variables.accountNumber === accountNumber

  function saveAccount(withCode?: string) {
    if (!resolved.data) return
    save.mutate(
      { bankCode, accountNumber, resolved: resolved.data, code: withCode },
      { onSuccess: () => navigate('/settings', { replace: true }) },
    )
  }

  function requestCode() {
    sendCode.mutate(
      { bankCode, accountNumber },
      {
        onSuccess: (result) => {
          // The server decides; if it says no code is needed (details here were out of date), just save.
          if (!result.needed) return saveAccount()
          setCode('')
          setResendIn(RESEND_AFTER)
        },
      },
    )
  }

  const busy = resolved.isFetching || save.isPending || sendCode.isPending
  const submitLabel = save.isPending
    ? 'Saving…'
    : codeStep
      ? 'Confirm and save'
      : needsCode
        ? sendCode.isPending
          ? 'Sending code…'
          : 'Send code to my WhatsApp'
        : 'Yes, use this account'

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
            if (!resolved.data || busy) return
            if (needsCode && !codeStep) return requestCode()
            saveAccount(needsCode ? code : undefined)
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

          {needsCode && resolved.data && !resolved.isFetching && !codeStep && (
            <Callout tone="info" icon={MessageSquareLock} className="motion-safe:animate-enter">
              {replacing ? 'You’re changing where rent is paid. ' : ''}To keep your money safe, we’ll send a code to
              your WhatsApp to confirm it’s you.
            </Callout>
          )}

          {codeStep && (
            <FormSection
              title="Enter the code from WhatsApp"
              description={
                sent?.sent_to === 'demo'
                  ? 'Demo mode: WhatsApp isn’t set up, so the code is in Supabase → Table Editor → dev_sms_outbox.'
                  : `We sent a 6-digit code to your WhatsApp, on the number ending ${sent?.phone_last4 ?? ''}. It works for 10 minutes.`
              }
            >
              <Field id="payoutCode" label="6-digit code">
                <Input
                  id="payoutCode"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="figure h-12 text-center text-xl font-semibold tracking-[0.4em] placeholder:tracking-[0.4em] md:text-xl"
                  autoFocus
                />
              </Field>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <WhatsAppIcon className="size-3.5" /> From RentPadi
                </span>
                <Button type="button" variant="ghost" size="sm" disabled={busy || resendIn > 0} onClick={requestCode}>
                  {resendIn > 0 ? `New code in ${resendIn}s` : 'Send a new code'}
                </Button>
              </div>
            </FormSection>
          )}

          <FormError message={resolved.error ? friendlyError(resolved.error) : null} />
          <FormError message={sendCode.error ? friendlyError(sendCode.error) : null} />
          <FormError message={save.error ? friendlyError(save.error) : null} />

          <Button
            type="submit"
            className="h-12 w-full text-base"
            disabled={!resolved.data || busy || unchanged || (codeStep && code.length !== 6)}
          >
            {submitLabel}
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
