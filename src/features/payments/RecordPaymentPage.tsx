import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router'
import { Field, FormError } from '@/components/Field'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { useTenantCharges } from '@/features/charges/api'
import type { Charge } from '@/lib/charges'
import { friendlyError } from '@/lib/errors'
import { formatKobo, parseNairaToKobo } from '@/lib/money'
import { formatDate, todayIso } from '@/lib/rent'
import { useRecordPayment } from './api'
import { recordPaymentSchema, type RecordPaymentValues } from './record-payment-form'

export function RecordPaymentPage() {
  const { tenantId = '', chargeId = '' } = useParams()
  const charges = useTenantCharges(tenantId)
  const charge = charges.data?.find((c) => c.id === chargeId)
  const back = `/tenants/${tenantId}`

  return (
    <>
      <PageHeader title="Record payment" subtitle="Cash or a transfer straight to your account." back={{ to: back, label: 'Back' }} />
      <QueryState isPending={charges.isPending} error={charges.error} refetch={charges.refetch} />
      {charges.data && !charge && <p className="text-sm">Rent charge not found.</p>}
      {charge && (charge.balance_kobo > 0 ? <RecordPaymentForm charge={charge} back={back} /> : <p className="text-sm">This period is fully paid.</p>)}
    </>
  )
}

function RecordPaymentForm({ charge, back }: { charge: Charge; back: string }) {
  const navigate = useNavigate()
  const record = useRecordPayment()
  const today = todayIso()
  const schema = useMemo(() => recordPaymentSchema(charge.balance_kobo, today), [charge.balance_kobo, today])
  const form = useForm<RecordPaymentValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: String(charge.balance_kobo / 100), method: 'cash', paidOn: today, note: '' },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((v) =>
    record.mutate(
      { chargeId: charge.id, amountKobo: parseNairaToKobo(v.amount)!, method: v.method, paidOn: v.paidOn, note: v.note },
      { onSuccess: () => navigate(back, { replace: true }) },
    ),
  )

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="bg-muted rounded-lg p-3 text-sm">
        <p className="font-medium">
          {formatDate(charge.period_start)} – {formatDate(charge.period_end)}
        </p>
        <p className="text-muted-foreground">
          {formatKobo(charge.balance_kobo)} owed
          {charge.amount_paid_kobo > 0 && ` (${formatKobo(charge.amount_paid_kobo)} of ${formatKobo(charge.amount_kobo)} paid)`}
        </p>
      </div>

      <Field id="amount" label="Amount received (₦)" error={errors.amount?.message} hint="Enter less for a part payment.">
        <Input id="amount" inputMode="decimal" className="h-12 text-base" autoFocus {...form.register('amount')} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id="method" label="How" error={errors.method?.message}>
          <NativeSelect id="method" {...form.register('method')}>
            <option value="cash">Cash</option>
            <option value="transfer">Bank transfer</option>
          </NativeSelect>
        </Field>
        <Field id="paidOn" label="Date received" error={errors.paidOn?.message}>
          <Input id="paidOn" type="date" max={today} className="h-12 text-base" {...form.register('paidOn')} />
        </Field>
      </div>

      <Field id="note" label="Note (optional)" error={errors.note?.message} hint="e.g. transfer reference, or who brought the cash.">
        <Input id="note" className="h-12 text-base" {...form.register('note')} />
      </Field>

      <FormError message={record.error ? friendlyError(record.error) : null} />
      <Button type="submit" className="h-12 w-full text-base" disabled={record.isPending}>
        {record.isPending ? 'Saving…' : 'Save payment'}
      </Button>
    </form>
  )
}
