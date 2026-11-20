import { zodResolver } from '@hookform/resolvers/zod'
import { Compass, Landmark, LifeBuoy, LogOut, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { CollapsibleCard } from '@/components/CollapsibleCard'
import { Field, FormError } from '@/components/Field'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { useLandlord, useUpdateProfile } from '@/features/landlord/api'
import { profileSchema, type ProfileForm } from '@/features/landlord/profile-schema'
import { useTour } from '@/features/onboarding/tour-context'
import { friendlyError } from '@/lib/errors'
import { formatNgPhone } from '@/lib/phone'
import { AppearanceCard } from './AppearanceCard'
import { ExportPaymentsCard } from './ExportPaymentsCard'
import { WhatsappCard } from './WhatsappCard'

export function SettingsPage() {
  const { signOut } = useAuth()
  const { data: landlord } = useLandlord()
  const save = useUpdateProfile()
  const tour = useTour()
  const [saved, setSaved] = useState(false)
  const form = useForm<z.input<typeof profileSchema>, unknown, ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      fullName: landlord?.full_name ?? '',
      displayName: landlord?.display_name ?? '',
      email: landlord?.email ?? '',
    },
  })
  const errors = form.formState.errors
  const unsave = { onChange: () => setSaved(false) }

  const onSubmit = form.handleSubmit((values) => save.mutate(values, { onSuccess: () => setSaved(true) }))

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-4">
        <CollapsibleCard
          id="profile"
          icon={<UserRound />}
          title="Your profile"
          description="Your name, the name tenants see, and your email."
          status={landlord ? formatNgPhone(landlord.phone) : undefined}
        >
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            <p className="text-muted-foreground text-sm">
              Signed in as {landlord ? formatNgPhone(landlord.phone) : '…'}
            </p>
            <Field id="fullName" label="Your full name" error={errors.fullName?.message}>
              <Input id="fullName" autoComplete="name" className="h-11" {...form.register('fullName', unsave)} />
            </Field>
            <Field
              id="displayName"
              label="Name tenants see (optional)"
              error={errors.displayName?.message}
              hint="On reminders, receipts and the payment page. Blank uses your full name."
            >
              <Input
                id="displayName"
                placeholder="e.g. Adeyemi Properties"
                className="h-11"
                {...form.register('displayName', unsave)}
              />
            </Field>
            <Field id="email" label="Email address" error={errors.email?.message}>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                className="h-11"
                {...form.register('email', unsave)}
              />
            </Field>
            <FormError message={save.error ? friendlyError(save.error) : null} />
            <Button type="submit" variant="secondary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : saved ? 'Saved' : 'Save'}
            </Button>
          </form>
        </CollapsibleCard>

        <CollapsibleCard
          id="payout"
          icon={<Landmark />}
          title="Payout account"
          description="The bank account tenants’ rent is paid into."
          status={
            landlord?.paystack_subaccount_code && landlord.account_number ? (
              `${landlord.bank_name} ••${landlord.account_number.slice(-4)}`
            ) : landlord?.account_number ? (
              <span className="text-foreground">Confirm account</span>
            ) : landlord ? (
              <span className="text-foreground">Not set up</span>
            ) : undefined
          }
          // Open while tenants can't pay online yet, and whenever the tour points here.
          defaultOpen={Boolean(landlord && !landlord.paystack_subaccount_code)}
          forceOpen={tour.active}
        >
          {landlord?.account_number ? (
            <div className="text-sm">
              <p className="font-semibold">{landlord.account_name}</p>
              <p className="text-muted-foreground">
                {landlord.bank_name} · ••••{landlord.account_number.slice(-4)}
              </p>
              {!landlord.paystack_subaccount_code && (
                <p className="text-muted-foreground mt-2">
                  Online payments now go through Paystack. Confirm this account once so tenants can keep paying
                  online.
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Not set up yet. Tenants can’t pay online until you add one.</p>
          )}
          <Button asChild variant={landlord?.paystack_subaccount_code ? 'outline' : 'default'} data-tour="payout-link">
            <Link to="/settings/payout">
              {landlord?.paystack_subaccount_code
                ? 'Change account'
                : landlord?.account_number
                  ? 'Confirm account'
                  : 'Set up payout account'}
            </Link>
          </Button>
        </CollapsibleCard>

        <WhatsappCard />

        <ExportPaymentsCard />

        <AppearanceCard />

        <CollapsibleCard
          id="help"
          icon={<LifeBuoy />}
          title="Help"
          description="A guided tour of the app, and the terms and privacy notice."
        >
          <p className="text-muted-foreground text-sm">
            A step-by-step guide to adding properties, units, tenants and your payout account.
          </p>
          <Button variant="outline" onClick={() => tour.start()}>
            <Compass /> Show me around
          </Button>
          <p className="text-muted-foreground text-sm">
            <Link to="/terms" className="underline underline-offset-2">
              Terms
            </Link>{' '}
            ·{' '}
            <Link to="/privacy" className="underline underline-offset-2">
              Privacy
            </Link>
          </p>
        </CollapsibleCard>

        <Button variant="outline" className="w-full" onClick={signOut}>
          <LogOut /> Sign out
        </Button>
      </div>
    </>
  )
}
