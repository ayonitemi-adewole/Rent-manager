import { Building2 } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { formatNgPhone, formatPhone } from '@/lib/phone'
import { todayIso } from '@/lib/rent'
import { useCreateTenant, useTenant, useUpdateTenant, useVacantUnits } from './api'
import { TenantForm } from './TenantForm'
import { tenantFormToRow } from './tenant-form'

export function NewTenantPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const vacant = useVacantUnits()
  const create = useCreateTenant()

  const preselected = vacant.data?.find((u) => u.id === params.get('unit'))

  return (
    <>
      <PageHeader title="Add tenant" back={{ to: '/tenants', label: 'Tenants' }} />
      <QueryState isPending={vacant.isPending} error={vacant.error} refetch={vacant.refetch} />

      {vacant.data?.length === 0 && (
        <EmptyState
          icon={Building2}
          title="No vacant units"
          description="Every unit has a tenant. Add a unit to a property first, or mark a tenant as moved out."
          action={
            <Button asChild>
              <Link to="/properties">Go to properties</Link>
            </Button>
          }
        />
      )}

      {vacant.data && vacant.data.length > 0 && (
        <TenantForm
          unitOptions={vacant.data}
          defaultValues={{
            unitId: preselected?.id ?? '',
            fullName: '',
            phone: '',
            whatsapp: '',
            startDate: todayIso(),
            rent: preselected ? String(preselected.rent_amount_kobo / 100) : '',
            rentPeriod: preselected?.rent_period ?? 'yearly',
            paidUntil: '',
            remindersEnabled: true,
          }}
          submitLabel="Add tenant"
          pending={create.isPending}
          error={create.error}
          onSubmit={(v) =>
            create.mutate(
              { ...tenantFormToRow(v), unit_id: v.unitId },
              { onSuccess: ({ id }) => navigate(`/tenants/${id}`, { replace: true }) },
            )
          }
        />
      )}
    </>
  )
}

export function EditTenantPage() {
  const { tenantId = '' } = useParams()
  const navigate = useNavigate()
  const query = useTenant(tenantId)
  const update = useUpdateTenant(tenantId)
  const t = query.data

  return (
    <>
      <PageHeader title="Edit tenant" back={{ to: `/tenants/${tenantId}`, label: 'Back' }} />
      <QueryState isPending={query.isPending} error={query.error} refetch={query.refetch} />
      {query.data === null && <p className="text-sm">Tenant not found.</p>}
      {t && (
        <TenantForm
          defaultValues={{
            unitId: t.unit_id,
            fullName: t.full_name,
            phone: formatNgPhone(t.phone),
            whatsapp: t.whatsapp_phone ? formatPhone(t.whatsapp_phone) : '',
            startDate: t.start_date,
            rent: String(t.rent_amount_kobo / 100),
            rentPeriod: t.rent_period,
            paidUntil: t.paid_until ?? '',
            remindersEnabled: t.reminders_enabled,
          }}
          submitLabel="Save changes"
          pending={update.isPending}
          error={update.error}
          onSubmit={(v) =>
            update.mutate(tenantFormToRow(v), {
              onSuccess: () => navigate(`/tenants/${tenantId}`, { replace: true }),
            })
          }
        />
      )}
    </>
  )
}
