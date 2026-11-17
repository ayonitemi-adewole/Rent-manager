import { MessageCircle } from 'lucide-react'
import { QueryState } from '@/components/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTenantCharges } from '@/features/charges/api'
import { useLandlord } from '@/features/landlord/api'
import { formatDate } from '@/lib/rent'
import { REMINDER_KIND_LABEL, reminderMessage, whatsappLink } from '@/lib/reminders'
import { useTenantReminders } from './api'

const STATUS: Record<string, { label: string; className: string }> = {
  queued: { label: 'Waiting for SMS setup', className: 'text-muted-foreground' },
  sent: { label: 'Sent', className: 'border-success/30 bg-success/10 text-success' },
  failed: { label: 'Failed', className: 'border-destructive/30 bg-destructive/10 text-destructive' },
  skipped: { label: 'Skipped', className: 'text-muted-foreground' },
}

type Props = {
  tenant: { id: string; full_name: string; phone: string; access_token: string; reminders_enabled: boolean }
  unitLabel: string
}

export function TenantReminders({ tenant, unitLabel }: Props) {
  const reminders = useTenantReminders(tenant.id)
  const charges = useTenantCharges(tenant.id)
  const { data: landlord } = useLandlord()

  // Most urgent open charge: the most overdue, else the soonest due.
  const open = (charges.data ?? [])
    .filter((c) => c.timing === 'overdue' || c.timing === 'due_soon')
    .sort((a, b) => a.days_until_due - b.days_until_due)[0]

  const whatsapp =
    open && landlord
      ? whatsappLink(
          tenant.phone,
          reminderMessage({
            daysUntilDue: open.days_until_due,
            tenantName: tenant.full_name,
            balanceKobo: open.balance_kobo,
            unitLabel,
            dueDate: open.due_date,
            link: `${window.location.origin}/t/${tenant.access_token}`,
            landlordName: landlord.full_name,
          }),
        )
      : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reminders</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          {tenant.reminders_enabled
            ? 'Automatic SMS 30, 14, 7 and 1 days before rent is due, then 1, 7 and 14 days late.'
            : 'Automatic reminders are off for this tenant.'}
        </p>

        {whatsapp && (
          <Button asChild variant="secondary" className="h-11 w-full">
            <a href={whatsapp} target="_blank" rel="noreferrer">
              <MessageCircle /> Send reminder on WhatsApp
            </a>
          </Button>
        )}

        <QueryState isPending={reminders.isPending} error={reminders.error} refetch={reminders.refetch} />
        {reminders.data && reminders.data.length > 0 && (
          <ul className="divide-y">
            {reminders.data.map((r) => {
              const status = STATUS[r.status] ?? STATUS.queued
              return (
                <li key={r.id} className="space-y-1 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {formatDate(r.scheduled_for)} · {REMINDER_KIND_LABEL[r.kind] ?? r.kind}
                    </span>
                    <Badge variant="outline" className={status.className}>
                      {status.label}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-xs">{r.message}</p>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
