import { MessageCircle } from 'lucide-react'
import { FormError } from '@/components/Field'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useLandlord, useSetWhatsappReminders } from '@/features/landlord/api'
import { env } from '@/lib/env'
import { friendlyError } from '@/lib/errors'
import { formatPhone } from '@/lib/phone'

/** Landlord-wide switch for WhatsApp reminders and receipts. */
export function WhatsappCard() {
  const { data: landlord } = useLandlord()
  const save = useSetWhatsappReminders()
  const on = save.isPending ? Boolean(save.variables) : Boolean(landlord?.whatsapp_reminders)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="text-success size-5" /> WhatsApp
        </CardTitle>
        <CardDescription>
          Tenants open WhatsApp more than SMS. Reminders and receipts can go to both.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
          <input
            type="checkbox"
            className="accent-primary mt-0.5 size-5 shrink-0"
            checked={on}
            disabled={!landlord || save.isPending}
            onChange={(e) => save.mutate(e.target.checked)}
          />
          <span>
            <span className="font-medium">Also send reminders and receipts on WhatsApp</span>
            <span className="text-muted-foreground block text-xs">
              Sent from RentPadi’s WhatsApp number, alongside SMS, to each tenant’s WhatsApp number (or their phone
              number if they haven’t given a separate one). Receipts arrive as a PDF.
            </span>
          </span>
        </label>
        <FormError message={save.error ? friendlyError(save.error) : null} />
        <p className="text-muted-foreground text-xs">
          {env.whatsappNumber
            ? `Tenants can also message ${formatPhone(env.whatsappNumber)} on WhatsApp any time to check their rent, pay, or get receipts.`
            : 'Tenants will also be able to chat with RentPadi on WhatsApp to check their rent, pay, or get receipts.'}
        </p>
      </CardContent>
    </Card>
  )
}
