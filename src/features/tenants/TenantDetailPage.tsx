import { Check, Copy, LogOut, MessageCircle, Pencil, Phone } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { FormError } from '@/components/Field'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { friendlyError } from '@/lib/errors'
import { formatKobo } from '@/lib/money'
import { formatNgPhone } from '@/lib/phone'
import { formatDate, rentPeriodLabel, todayIso } from '@/lib/rent'
import { TenantCharges } from '@/features/charges/TenantCharges'
import { useTenant, useUpdateTenant } from './api'

export function TenantDetailPage() {
  const { tenantId = '' } = useParams()
  const { data: t, isPending, error, refetch } = useTenant(tenantId)
  const update = useUpdateTenant(tenantId)
  const [copied, setCopied] = useState(false)

  const tenantLink = t ? `${window.location.origin}/t/${t.access_token}` : ''
  const active = t?.status === 'active'

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(tenantLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      prompt('Copy this link:', tenantLink)
    }
  }

  function moveOut() {
    if (!t) return
    if (!confirm(`Mark ${t.full_name} as moved out today? The unit becomes vacant.`)) return
    update.mutate({ status: 'moved_out', moved_out_at: todayIso() })
  }

  return (
    <>
      <PageHeader
        title={t?.full_name ?? 'Tenant'}
        subtitle={t?.units ? `${t.units.label} · ${t.units.properties?.name ?? ''}` : undefined}
        back={{ to: '/tenants', label: 'Tenants' }}
        action={
          t && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/tenants/${tenantId}/edit`}>
                <Pencil /> Edit
              </Link>
            </Button>
          )
        }
      />
      <QueryState isPending={isPending} error={error} refetch={refetch} />
      {t === null && <p className="text-sm">Tenant not found.</p>}

      {t && (
        <div className="space-y-4">
          {!active && (
            <Badge variant="secondary">Moved out {t.moved_out_at && formatDate(t.moved_out_at)}</Badge>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="secondary" className="h-11">
              <a href={`tel:${t.phone}`}>
                <Phone /> Call
              </a>
            </Button>
            <Button asChild variant="secondary" className="h-11">
              <a href={`https://wa.me/${t.phone.replace('+', '')}`} target="_blank" rel="noreferrer">
                <MessageCircle /> WhatsApp
              </a>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Tenancy</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y text-sm">
                <Row label="Phone">{formatNgPhone(t.phone)}</Row>
                <Row label="Unit">
                  {t.units && (
                    <Link to={`/properties/${t.units.property_id}`} className="text-primary hover:underline">
                      {t.units.label} · {t.units.properties?.name}
                    </Link>
                  )}
                </Row>
                <Row label="Rent">
                  {formatKobo(t.rent_amount_kobo)} · {rentPeriodLabel(t.rent_period)}
                </Row>
                <Row label="Started">{formatDate(t.start_date)}</Row>
                <Row label="Paid up to">{t.paid_until ? formatDate(t.paid_until) : '—'}</Row>
                <Row label="Reminders">{t.reminders_enabled ? 'On' : 'Off'}</Row>
              </dl>
            </CardContent>
          </Card>

          {active && (
            <Card>
              <CardHeader>
                <CardTitle>Tenant’s payment link</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-muted-foreground text-sm">
                  The tenant opens this to see what they owe and pay. No login needed. Online payment comes
                  in a later update.
                </p>
                <div className="flex gap-2">
                  <code className="bg-muted min-w-0 flex-1 truncate rounded-md px-3 py-2 text-xs">{tenantLink}</code>
                  <Button variant="outline" size="icon" onClick={copyLink} aria-label="Copy link">
                    {copied ? <Check /> : <Copy />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <TenantCharges tenantId={t.id} />

          {active && (
            <div className="space-y-3 border-t pt-6">
              <FormError message={update.error ? friendlyError(update.error) : null} />
              <Button variant="outline" className="w-full" onClick={moveOut} disabled={update.isPending}>
                <LogOut /> Mark as moved out
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}
