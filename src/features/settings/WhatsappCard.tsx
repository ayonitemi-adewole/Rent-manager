import { FormError } from '@/components/Field'
import { CollapsibleCard } from '@/components/CollapsibleCard'
import { useLandlord, useSetWhatsappReminders } from '@/features/landlord/api'
import { useFeature } from '@/features/plan/api'
import { env } from '@/lib/env'
import { friendlyError } from '@/lib/errors'
import { formatPhone } from '@/lib/phone'
import { WhatsAppIcon } from '@/components/WhatsAppIcon'
import { Switch } from '@/components/ui/switch'

/** Landlord-wide switch for WhatsApp reminders and receipts. */
export function WhatsappCard() {
  const { data: landlord } = useLandlord()
  const save = useSetWhatsappReminders()
  const remindersIncluded = useFeature('whatsapp_reminders')
  const on = save.isPending ? Boolean(save.variables) : Boolean(landlord?.whatsapp_reminders)

  return (
    <CollapsibleCard
      id="whatsapp"
      icon={<WhatsAppIcon />}
      title="WhatsApp"
      description="Send reminders and receipts on WhatsApp as well as SMS."
      status={landlord ? (on ? 'On' : 'Off') : undefined}
    >
      <p className="text-muted-foreground text-sm">
        Tenants open WhatsApp more than SMS. Reminders and receipts can go to both.
      </p>
      <label className="flex cursor-pointer items-start gap-4 rounded-lg border p-3.5 text-sm">
        <span className="min-w-0 flex-1">
          <span className="font-semibold">Also send reminders and receipts on WhatsApp</span>
          <span className="text-muted-foreground mt-0.5 block text-xs leading-relaxed">
            Sent from RentPadi’s WhatsApp number, alongside SMS, to each tenant’s WhatsApp number (or their phone number
            if they haven’t given a separate one). Receipts arrive as a PDF.
          </span>
        </span>
        <Switch
          className="mt-0.5"
          checked={on}
          disabled={!landlord || save.isPending}
          onChange={(e) => save.mutate(e.target.checked)}
        />
      </label>
      {on && !remindersIncluded && (
        <p className="bg-warning/10 border-warning/45 rounded-lg border p-3 text-xs">
          Your plan sends <strong>receipts</strong> on WhatsApp. WhatsApp <strong>reminders</strong> are included from
          the Padi plan; until then reminders go by SMS. See Plan above.
        </p>
      )}
      <FormError message={save.error ? friendlyError(save.error) : null} />
      <p className="text-muted-foreground text-xs">
        {env.whatsappNumber
          ? `Tenants can also message ${formatPhone(env.whatsappNumber)} on WhatsApp any time to check their rent, pay, or get receipts.`
          : 'Tenants will also be able to chat with RentPadi on WhatsApp to check their rent, pay, or get receipts.'}
      </p>
    </CollapsibleCard>
  )
}
