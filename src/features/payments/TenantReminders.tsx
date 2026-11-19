import { MessageCircle, Send } from 'lucide-react'
import { QueryState } from '@/components/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTenantCharges } from '@/features/charges/api'
import { useLandlord } from '@/features/landlord/api'
import { env } from '@/lib/env'
import { formatPhone } from '@/lib/phone'
import { formatDate } from '@/lib/rent'
import type { RentPeriod } from '@/lib/rent'
import { REMINDER_KIND_LABEL, reminderDaysBefore, reminderMessage, whatsappLink } from '@/lib/reminders'
import { useSendReminderNow, useTenantReminders } from './api'

const CHANNEL: Record<string, string> = { sms: 'SMS', whatsapp: 'WhatsApp' }

const STATUS: Record<string, { label: string; className: string }> = {
  queued: { label: 'Queued', className: 'text-muted-foreground' },
  sending: { label: 'Sending', className: 'text-muted-foreground' },
  sent: { label: 'Sent', className: 'border-success/30 bg-success/10 text-success' },
  failed: { label: 'Failed', className: 'border-destructive/30 bg-destructive/10 text-destructive' },
  skipped: { label: 'Skipped', className: 'text-muted-foreground' },
}

type Props = {
  tenant: {
    id: string
    full_name: string
    phone: string
    whatsapp_phone: string | null
    access_token: string
    reminders_enabled: boolean
    rent_period: RentPeriod
  }
  unitLabel: string
}

export function TenantReminders({ tenant, unitLabel }: Props) {
  const reminders = useTenantReminders(tenant.id)
  const charges = useTenantCharges(tenant.id)
  const { data: landlord } = useLandlord()
  const sendNow = useSendReminderNow(tenant.id)
  // RentPadi's own WhatsApp number is set once WhatsApp Business is live.
  const canSendFromRentPadi = Boolean(env.whatsappNumber)

  // Most urgent open charge: the most overdue, else the soonest due.
  const open = (charges.data ?? [])
    .filter((c) => c.timing === 'overdue' || c.timing === 'due_soon')
    .sort((a, b) => a.days_until_due - b.days_until_due)[0]

  const whatsapp =
    open && landlord
      ? whatsappLink(
          tenant.whatsapp_phone ?? tenant.phone,
          reminderMessage({
            daysUntilDue: open.days_until_due,
            tenantName: tenant.full_name,
            balanceKobo: open.balance_kobo,
            unitLabel,
            dueDate: open.due_date,
            link: `${window.location.origin}/t/${tenant.access_token}`,
            landlordName: landlord.name_for_tenants ?? landlord.full_name,
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
            ? `Automatic ${landlord?.whatsapp_reminders ? 'SMS and WhatsApp' : 'SMS'} ${reminderDaysBefore(tenant.rent_period)} days before rent is due, then 1, 7 and 14 days late.`
            : 'Automatic reminders are off for this tenant.'}
        </p>

        {whatsapp && canSendFromRentPadi && (
          <div className="space-y-2">
            <Button
              className="h-11 w-full"
              disabled={sendNow.isPending || sendNow.isSuccess}
              onClick={() => sendNow.mutate()}
            >
              <Send /> {sendNow.isPending ? 'Sending…' : 'Send reminder from RentPadi'}
            </Button>
            {sendNow.isSuccess ? (
              <p role="status" className="text-success text-xs">
                Reminder sent on WhatsApp to {formatPhone(sendNow.data.to)}.
              </p>
            ) : sendNow.isError ? (
              <p role="alert" className="text-destructive text-xs">
                {sendNow.error.message}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Sent from RentPadi’s WhatsApp with a Pay button. You can send one every 12 hours.
              </p>
            )}
            <Button asChild variant="secondary" className="h-11 w-full">
              <a href={whatsapp} target="_blank" rel="noreferrer">
                <MessageCircle /> Send from my own WhatsApp
              </a>
            </Button>
          </div>
        )}
        {whatsapp && !canSendFromRentPadi && (
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
                      <span className="text-muted-foreground font-normal"> · {CHANNEL[r.channel] ?? r.channel}</span>
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
