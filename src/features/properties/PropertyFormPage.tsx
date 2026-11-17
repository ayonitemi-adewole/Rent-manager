import { zodResolver } from '@hookform/resolvers/zod'
import { Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router'
import { z } from 'zod'
import { Field, FormError } from '@/components/Field'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { friendlyError } from '@/lib/errors'
import { useCreateProperty, useDeleteProperty, useProperty, useUpdateProperty } from './api'

const schema = z.object({
  name: z.string().trim().min(1, 'Give the property a name').max(100),
  address: z.string().trim().max(300),
})
type FormValues = z.infer<typeof schema>

export function NewPropertyPage() {
  const navigate = useNavigate()
  const create = useCreateProperty()
  return (
    <>
      <PageHeader title="Add property" back={{ to: '/properties', label: 'Properties' }} />
      <PropertyForm
        defaultValues={{ name: '', address: '' }}
        submitLabel="Save and add units"
        pending={create.isPending}
        error={create.error}
        onSubmit={(v) =>
          create.mutate(
            { name: v.name, address: v.address || null },
            { onSuccess: ({ id }) => navigate(`/properties/${id}/units/new`, { replace: true }) },
          )
        }
      />
    </>
  )
}

export function EditPropertyPage() {
  const { propertyId = '' } = useParams()
  const navigate = useNavigate()
  const query = useProperty(propertyId)
  const update = useUpdateProperty(propertyId)
  const remove = useDeleteProperty(propertyId)
  const property = query.data

  return (
    <>
      <PageHeader title="Edit property" back={{ to: `/properties/${propertyId}`, label: 'Back' }} />
      <QueryState isPending={query.isPending} error={query.error} refetch={query.refetch} />
      {query.data === null && <p className="text-sm">Property not found.</p>}
      {property && (
        <>
          <PropertyForm
            defaultValues={{ name: property.name, address: property.address ?? '' }}
            submitLabel="Save changes"
            pending={update.isPending}
            error={update.error}
            onSubmit={(v) =>
              update.mutate(
                { name: v.name, address: v.address || null },
                { onSuccess: () => navigate(`/properties/${propertyId}`, { replace: true }) },
              )
            }
          />
          <div className="mt-10 space-y-3 border-t pt-6">
            <h2 className="text-sm font-semibold">Delete property</h2>
            <p className="text-muted-foreground text-sm">
              Removes the property and its units. Not possible once a unit has had a tenant, to protect
              your rent records.
            </p>
            <FormError
              message={
                remove.error
                  ? friendlyError(remove.error, {
                      inUse: 'This property has tenant records, so it cannot be deleted.',
                    })
                  : null
              }
            />
            <Button
              variant="outline"
              className="text-destructive"
              disabled={remove.isPending}
              onClick={() => {
                if (confirm(`Delete "${property.name}" and all its units?`)) {
                  remove.mutate(undefined, { onSuccess: () => navigate('/properties', { replace: true }) })
                }
              }}
            >
              <Trash2 /> Delete property
            </Button>
          </div>
        </>
      )}
    </>
  )
}

type FormProps = {
  defaultValues: FormValues
  submitLabel: string
  pending: boolean
  error: unknown
  onSubmit: (values: FormValues) => void
}

function PropertyForm({ defaultValues, submitLabel, pending, error, onSubmit }: FormProps) {
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues })
  const { errors } = form.formState

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field id="name" label="Property name" error={errors.name?.message} hint="What you call it, e.g. “Bodija house” or “Ring Road shops”">
        <Input id="name" className="h-12 text-base" autoFocus {...form.register('name')} />
      </Field>
      <Field id="address" label="Address (optional)" error={errors.address?.message}>
        <Input id="address" className="h-12 text-base" autoComplete="street-address" {...form.register('address')} />
      </Field>
      <FormError message={error ? friendlyError(error) : null} />
      <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  )
}
