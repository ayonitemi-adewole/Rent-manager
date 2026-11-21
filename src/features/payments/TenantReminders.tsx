import { MessageCircle, MessageSquareText, Send } from 'lucide-react'
import { QueryState } from '@/components/QueryState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useTenantCharges } from '@/features/charges/api'
import { useLandlord } from '@/features/landlord/api'
import { useFeature } from '@/features/plan/api'
import { env } from '@/lib/env'
import { formatPhone } from '@/lib/phone'
import { formatDate } from '@/lib/rent'
import type { RentPeriod } from '@/lib/rent'
import { REMINDER_KIND_LABEL, reminderDaysBefore, reminderMessage, whatsappLink } from '@/lib/reminders'
import { useSendReminderNow, useTenantReminders } from './api'
import { WhatsAppIcon } from '@/components/WhatsAppIcon'

const CHANNEL: Record<string, string> = { sms: 'SMS', whatsapp: 'WhatsApp' }

const STATUS: Record<string, { label: string; variant: 'muted' | 'success' | 'danger' }> = {
  queued: { label: 'Queued', variant: 'muted' },
  sending: { label: 'Sending', variant: 'muted' },
  sent: { label: 'Sent', variant: 'success' },
  failed: { label: 'Failed', variant: 'danger' },
  skipped: { label: 'Skipped', variant: 'muted' },
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
  // WhatsApp reminders come with the plan (Padi and up); the server enforces it too.
  const whatsappReminders = useFeature('whatsapp_reminders')
  // RentPadi's own WhatsApp number is set once WhatsApp Business is live.
  const canSendFromRentPadi = Boolean(env.whatsappNumber) && whatsappReminders

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
        <CardTitle className="flex items-center justify-between gap-2">
          Reminders
          <Badge variant={tenant.reminders_enabled ? 'success' : 'muted'} dot>
            {tenant.reminders_enabled ? 'On' : 'Off'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          {tenant.reminders_enabled
            ? `Automatic ${landlord?.whatsapp_reminders && whatsappReminders ? 'SMS and WhatsApp' : 'SMS'} ${reminderDaysBefore(tenant.rent_period)} days before rent is due, then 1, 7 and 14 days late.`
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
          <div className="space-y-2">
            <Button asChild variant="secondary" className="h-11 w-full">
              <a href={whatsapp} target="_blank" rel="noreferrer">
                <WhatsAppIcon /> Send reminder on WhatsApp
              </a>
            </Button>
            {env.whatsappNumber && !whatsappReminders && (
              <p className="text-muted-foreground text-xs">
                Sending from RentPadi’s WhatsApp, with a Pay button, is included from the Padi plan.
              </p>
            )}
          </div>
        )}

        <QueryState isPending={reminders.isPending} error={reminders.error} refetch={reminders.refetch} />
        {reminders.data && reminders.data.length > 0 && (
          <ul className="divide-y border-t">
            {reminders.data.map((r) => {
              const status = STATUS[r.status] ?? STATUS.queued
              return (
                <li key={r.id} className="space-y-1.5 py-3 text-sm last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 font-semibold">
                      {r.channel === 'whatsapp' ? (
                        <WhatsAppIcon className="size-3.5" />
                      ) : (
                        <MessageSquareText className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
                      )}
                      <span className="min-w-0">
                        {formatDate(r.scheduled_for)} · {REMINDER_KIND_LABEL[r.kind] ?? r.kind}
                        <span className="text-muted-foreground font-normal"> · {CHANNEL[r.channel] ?? r.channel}</span>
                      </span>
                    </span>
                    <Badge variant={status.variant} dot>
                      {status.label}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground bg-muted/60 rounded-md px-2.5 py-2 text-xs leading-relaxed">{r.message}</p>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
