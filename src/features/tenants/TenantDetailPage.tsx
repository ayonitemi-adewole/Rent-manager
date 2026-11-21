import { Check, Copy, FileText, Link2, LogOut, Pencil, Phone, RefreshCw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ConfirmAction } from '@/components/ConfirmAction'
import { FormError } from '@/components/Field'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WhatsAppIcon } from '@/components/WhatsAppIcon'
import { friendlyError } from '@/lib/errors'
import { formatNgPhone, formatPhone } from '@/lib/phone'
import { formatDate, rentPeriodLabel, todayIso } from '@/lib/rent'
import { cn } from '@/lib/utils'
import { TenantCharges } from '@/features/charges/TenantCharges'
import { TenantPayments } from '@/features/payments/TenantPayments'
import { TenantReminders } from '@/features/payments/TenantReminders'
import { useResetTenantLink, useTenant, useUpdateTenant } from './api'

export function TenantDetailPage() {
  const { tenantId = '' } = useParams()
  const { data: t, isPending, error, refetch } = useTenant(tenantId)
  const update = useUpdateTenant(tenantId)
  const resetLink = useResetTenantLink(tenantId)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  const tenantLink = t ? `${window.location.origin}/t/${t.access_token}` : ''
  const active = t?.status === 'active'

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(tenantLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyFailed(true) // clipboard blocked: the link is shown, press and hold to copy
    }
  }

  return (
    <>
      <PageHeader
        title={t?.full_name ?? 'Tenant'}
        subtitle={
          t && (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {t.units && `${t.units.label} · ${t.units.properties?.name ?? ''}`}
              {!active && (
                <Badge variant="muted">Moved out {t.moved_out_at && formatDate(t.moved_out_at)}</Badge>
              )}
            </span>
          )
        }
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
        // Phones: one column. Large screens: tenancy on the left, money on the right; "moved out" stays last.
        <div className="space-y-4 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-6 lg:space-y-0">
          <div className="space-y-4 lg:col-start-1 lg:row-start-1">
            <div className="grid grid-cols-2 gap-2">
              <Button asChild variant="outline" className="h-11">
                <a href={`tel:${t.phone}`}>
                  <Phone className="text-primary" /> Call
                </a>
              </Button>
              <Button asChild variant="outline" className="h-11">
                <a href={`https://wa.me/${(t.whatsapp_phone ?? t.phone).replace('+', '')}`} target="_blank" rel="noreferrer">
                  <WhatsAppIcon /> WhatsApp
                </a>
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Tenancy</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-y text-sm">
                  <Row label="Phone">
                    <span className="figure">{formatNgPhone(t.phone)}</span>
                  </Row>
                  {t.whatsapp_phone && (
                    <Row label="WhatsApp">
                      <span className="figure">{formatPhone(t.whatsapp_phone)}</span>
                    </Row>
                  )}
                  <Row label="Unit">
                    {t.units && (
                      <Link to={`/properties/${t.units.property_id}`} className="text-primary hover:underline">
                        {t.units.label} · {t.units.properties?.name}
                      </Link>
                    )}
                  </Row>
                  <Row label="Rent">
                    <Money kobo={t.rent_amount_kobo} /> · {rentPeriodLabel(t.rent_period)}
                  </Row>
                  <Row label="Started">{formatDate(t.start_date)}</Row>
                  <Row label="Paid up to">{t.paid_until ? formatDate(t.paid_until) : '—'}</Row>
                  <Row label="Reminders">
                    <Badge variant={t.reminders_enabled ? 'success' : 'muted'} dot>
                      {t.reminders_enabled ? 'On' : 'Off'}
                    </Badge>
                  </Row>
                </dl>
              </CardContent>
            </Card>

            {active && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="text-primary size-4.5" /> Tenant’s payment link
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-muted-foreground text-sm">
                    The tenant opens this to see what they owe and pay online. No login needed. It’s also in every
                    reminder.
                  </p>
                  <div className="bg-muted flex items-center gap-1 rounded-lg p-1 pl-3">
                    <code
                      className={cn(
                        'figure min-w-0 flex-1 py-1.5 text-xs',
                        copyFailed ? 'break-all select-all' : 'truncate',
                      )}
                    >
                      {tenantLink}
                    </code>
                    <Button
                      variant={copied ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={copyLink}
                      aria-label={copied ? 'Link copied' : 'Copy link'}
                      className="shrink-0"
                    >
                      {copied ? <Check /> : <Copy />}
                      <span aria-hidden="true">{copied ? 'Copied' : 'Copy'}</span>
                    </Button>
                  </div>
                  {copyFailed && <p className="text-muted-foreground text-xs">Couldn’t copy automatically. Press and hold the link to copy it.</p>}
                  <ConfirmAction
                    trigger={
                      <>
                        <RefreshCw /> Reset link
                      </>
                    }
                    triggerVariant="ghost"
                    triggerClassName="text-muted-foreground -ml-2"
                    question="Make a new link? The old one stops working right away, including in reminders already sent."
                    confirmLabel="Reset link"
                    pending={resetLink.isPending}
                    onConfirm={() => resetLink.mutate()}
                  />
                  <FormError message={resetLink.error ? friendlyError(resetLink.error) : null} />
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <TenantCharges tenantId={t.id} />
            <TenantPayments tenantId={t.id} />
            <Button asChild variant="outline" className="h-11 w-full">
              <Link to={`/tenants/${tenantId}/statement`}>
                <FileText /> Full statement and CSV
              </Link>
            </Button>
            {active && <TenantReminders tenant={t} unitLabel={t.units?.label ?? ''} />}
          </div>

          {active && (
            <div className="space-y-3 border-t border-dashed pt-6 lg:col-start-1 lg:row-start-2">
              <FormError message={update.error ? friendlyError(update.error) : null} />
              <ConfirmAction
                trigger={
                  <>
                    <LogOut /> Mark as moved out
                  </>
                }
                triggerClassName="w-full"
                question={`Mark ${t.full_name} as moved out today? The unit becomes vacant.`}
                confirmLabel="Yes, moved out"
                pending={update.isPending}
                onConfirm={() => update.mutate({ status: 'moved_out', moved_out_at: todayIso() })}
              />
            </div>
          )}
        </div>
      )}
    </>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  )
}
