import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Field, FormError } from '@/components/Field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { friendlyError } from '@/lib/errors'
import { formatKobo } from '@/lib/money'
import { RENT_PERIODS } from '@/lib/rent'
import { tenantFormSchema, type TenantFormValues, type UnitOption } from './tenant-form'

type Props = {
  defaultValues: TenantFormValues
  /** When given, show a unit picker (new tenant). Omit when editing. */
  unitOptions?: UnitOption[]
  submitLabel: string
  pending: boolean
  error: unknown
  onSubmit: (values: TenantFormValues) => void
}

export function TenantForm({ defaultValues, unitOptions, submitLabel, pending, error, onSubmit }: Props) {
  const form = useForm<TenantFormValues>({ resolver: zodResolver(tenantFormSchema), defaultValues })
  const { errors } = form.formState
  const unitReg = form.register('unitId')

  // Group vacant units by property for <optgroup>.
  const groups = new Map<string, { name: string; units: UnitOption[] }>()
  for (const u of unitOptions ?? []) {
    const key = u.properties?.id ?? ''
    if (!groups.has(key)) groups.set(key, { name: u.properties?.name ?? 'Other', units: [] })
    groups.get(key)!.units.push(u)
  }

  // Picking a unit pre-fills its advertised rent, unless the landlord already typed one.
  function applyUnitDefaults(unitId: string) {
    const unit = unitOptions?.find((u) => u.id === unitId)
    if (!unit || form.getFieldState('rent').isDirty) return
    form.setValue('rent', String(unit.rent_amount_kobo / 100))
    form.setValue('rentPeriod', unit.rent_period)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {unitOptions && (
        <Field id="unitId" label="Unit" error={errors.unitId?.message}>
          <NativeSelect
            id="unitId"
            {...unitReg}
            onChange={(e) => {
              void unitReg.onChange(e)
              applyUnitDefaults(e.target.value)
            }}
          >
            <option value="">Choose a vacant unit…</option>
            {[...groups.values()].map((g) => (
              <optgroup key={g.name} label={g.name}>
                {g.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label} · {formatKobo(u.rent_amount_kobo)}
                  </option>
                ))}
              </optgroup>
            ))}
          </NativeSelect>
        </Field>
      )}

      <Field id="fullName" label="Tenant’s full name" error={errors.fullName?.message}>
        <Input id="fullName" autoComplete="off" className="h-12 text-base" {...form.register('fullName')} />
      </Field>

      <Field
        id="phone"
        label="Tenant’s phone number"
        error={errors.phone?.message}
        hint="Rent reminders and receipts go to this number."
      >
        <Input id="phone" type="tel" inputMode="tel" placeholder="0803 123 4567" className="h-12 text-base" {...form.register('phone')} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id="rent" label="Rent (₦)" error={errors.rent?.message}>
          <Input id="rent" inputMode="decimal" placeholder="350,000" className="h-12 text-base" {...form.register('rent')} />
        </Field>
        <Field id="rentPeriod" label="Paid" error={errors.rentPeriod?.message}>
          <NativeSelect id="rentPeriod" {...form.register('rentPeriod')}>
            {RENT_PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Field
        id="startDate"
        label="Tenancy start date"
        error={errors.startDate?.message}
        hint="Rent falls due on this date each period."
      >
        <Input id="startDate" type="date" className="h-12 text-base" {...form.register('startDate')} />
      </Field>

      <Field
        id="paidUntil"
        label="Rent already paid up to (optional)"
        error={errors.paidUntil?.message}
        hint="For tenants already living there: the date their current rent runs out. Leave empty if they haven’t paid yet."
      >
        <Input id="paidUntil" type="date" className="h-12 text-base" {...form.register('paidUntil')} />
      </Field>

      <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
        <input type="checkbox" className="accent-primary mt-0.5 size-4" {...form.register('remindersEnabled')} />
        <span>
          <span className="font-medium">Send rent reminders</span>
          <span className="text-muted-foreground block text-xs">SMS before rent is due and when it’s late.</span>
        </span>
      </label>

      <FormError
        message={
          error ? friendlyError(error, { unique: 'That unit already has a current tenant.' }) : null
        }
      />
      <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  )
}
