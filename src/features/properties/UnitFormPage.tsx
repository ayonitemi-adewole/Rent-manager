import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { Field, FormError } from '@/components/Field'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { ConfirmAction } from '@/components/ConfirmAction'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { friendlyError } from '@/lib/errors'
import { parseNairaToKobo } from '@/lib/money'
import { RENT_PERIODS, UNIT_TYPES, type RentPeriod, type UnitType } from '@/lib/rent'
import { useCreateUnit, useDeleteUnit, useUnit, useUpdateUnit } from './api'
import { UnitHistory } from './UnitHistory'

const schema = z.object({
  label: z.string().trim().min(1, 'Give the unit a name').max(50),
  unitType: z.enum(UNIT_TYPES.map((t) => t.value) as [UnitType, ...UnitType[]]),
  rent: z.string().refine((v) => (parseNairaToKobo(v) ?? 0) > 0, 'Enter the rent in naira, e.g. 350,000'),
  rentPeriod: z.enum(RENT_PERIODS.map((p) => p.value) as [RentPeriod, ...RentPeriod[]]),
})
type FormValues = z.infer<typeof schema>

const toRow = (v: FormValues) => ({
  label: v.label,
  unit_type: v.unitType,
  rent_amount_kobo: parseNairaToKobo(v.rent)!,
  rent_period: v.rentPeriod,
})

const UNIQUE_LABEL = 'This property already has a unit with that name.'

export function NewUnitPage() {
  const { propertyId = '' } = useParams()
  const navigate = useNavigate()
  const create = useCreateUnit()
  const back = `/properties/${propertyId}`
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  return (
    <>
      <PageHeader title="Add unit" back={{ to: back, label: 'Back' }} />
      {lastSaved && (
        <p role="status" className="bg-secondary text-secondary-foreground mb-4 rounded-md p-3 text-sm">
          Saved “{lastSaved}”. Add the next one, or go back when you’re done.
        </p>
      )}
      <UnitForm
        defaultValues={{ label: '', unitType: 'room', rent: '', rentPeriod: 'yearly' }}
        pending={create.isPending}
        error={create.error}
        onSubmit={(v, addAnother, reset) =>
          create.mutate(
            { ...toRow(v), property_id: propertyId },
            {
              onSuccess: () => {
                if (!addAnother) return navigate(back, { replace: true })
                setLastSaved(v.label)
                reset({ ...v, label: '' }) // keep type/rent: units in a building are usually alike
              },
            },
          )
        }
        showAddAnother
      />
    </>
  )
}

export function EditUnitPage() {
  const { propertyId = '', unitId = '' } = useParams()
  const navigate = useNavigate()
  const query = useUnit(unitId)
  const update = useUpdateUnit(unitId)
  const remove = useDeleteUnit(unitId)
  const back = `/properties/${propertyId}`
  const unit = query.data

  return (
    <>
      <PageHeader title="Edit unit" back={{ to: back, label: 'Back' }} />
      <QueryState isPending={query.isPending} error={query.error} refetch={query.refetch} />
      {query.data === null && <p className="text-sm">Unit not found.</p>}
      {unit && (
        <>
          <UnitForm
            defaultValues={{
              label: unit.label,
              unitType: unit.unit_type,
              rent: String(unit.rent_amount_kobo / 100),
              rentPeriod: unit.rent_period,
            }}
            hint="Changing the rent here does not change what current tenants pay. Edit the tenant for that."
            pending={update.isPending}
            error={update.error}
            onSubmit={(v) => update.mutate(toRow(v), { onSuccess: () => navigate(back, { replace: true }) })}
          />
          <UnitHistory unitId={unitId} />
          <div className="mt-10 space-y-3 border-t pt-6">
            <FormError
              message={
                remove.error
                  ? friendlyError(remove.error, {
                      inUse: 'This unit has tenant records, so it cannot be deleted.',
                    })
                  : null
              }
            />
            <ConfirmAction
              trigger={
                <>
                  <Trash2 /> Delete unit
                </>
              }
              triggerClassName="text-destructive"
              question={`Delete unit “${unit.label}”?`}
              confirmLabel="Delete unit"
              pending={remove.isPending}
              onConfirm={() => remove.mutate(undefined, { onSuccess: () => navigate(back, { replace: true }) })}
            />
          </div>
        </>
      )}
    </>
  )
}

type FormProps = {
  defaultValues: FormValues
  pending: boolean
  error: unknown
  hint?: string
  showAddAnother?: boolean
  onSubmit: (values: FormValues, addAnother: boolean, reset: (v: FormValues) => void) => void
}

function UnitForm({ defaultValues, pending, error, hint, showAddAnother, onSubmit }: FormProps) {
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues })
  const { errors } = form.formState
  const submit = (addAnother: boolean) =>
    form.handleSubmit((v) => {
      onSubmit(v, addAnother, (next) => {
        form.reset(next)
        form.setFocus('label')
      })
    })

  return (
    <form onSubmit={submit(false)} className="space-y-4" noValidate data-tour="unit-form">
      <Field id="label" label="Unit name" error={errors.label?.message} hint="e.g. “Room 3”, “Flat 2B”, “Shop 1”">
        <Input id="label" className="h-12 text-base" autoFocus {...form.register('label')} />
      </Field>
      <Field id="unitType" label="Type" error={errors.unitType?.message}>
        <NativeSelect id="unitType" {...form.register('unitType')}>
          {UNIT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </NativeSelect>
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
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      <FormError message={error ? friendlyError(error, { unique: UNIQUE_LABEL }) : null} />
      <div className="space-y-2">
        <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
        {showAddAnother && (
          <Button type="button" variant="outline" className="h-12 w-full text-base" disabled={pending} onClick={submit(true)}>
            Save and add another
          </Button>
        )}
      </div>
    </form>
  )
}
