import { zodResolver } from '@hookform/resolvers/zod'
import { Compass, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { Field, FormError } from '@/components/Field'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { useLandlord, useUpdateProfile } from '@/features/landlord/api'
import { profileSchema, type ProfileForm } from '@/features/landlord/profile-schema'
import { useTour } from '@/features/onboarding/tour-context'
import { friendlyError } from '@/lib/errors'
import { formatNgPhone } from '@/lib/phone'
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
        <Card>
          <CardHeader>
            <CardTitle>Your profile</CardTitle>
            <CardDescription>{landlord ? formatNgPhone(landlord.phone) : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-3" noValidate>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payout account</CardTitle>
            <CardDescription>The bank account tenants’ rent is paid into.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {landlord?.account_number ? (
              <div className="text-sm">
                <p className="font-semibold">{landlord.account_name}</p>
                <p className="text-muted-foreground">
                  {landlord.bank_name} · ••••{landlord.account_number.slice(-4)}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Not set up yet. Tenants can’t pay online until you add one.
              </p>
            )}
            <Button asChild variant={landlord?.account_number ? 'outline' : 'default'} data-tour="payout-link">
              <Link to="/settings/payout">{landlord?.account_number ? 'Change account' : 'Set up payout account'}</Link>
            </Button>
          </CardContent>
        </Card>

        <WhatsappCard />

        <ExportPaymentsCard />

        <Card>
          <CardHeader>
            <CardTitle>Help</CardTitle>
            <CardDescription>
              A step-by-step guide to adding properties, units, tenants and your payout account.{' '}
              <Link to="/terms" className="underline underline-offset-2">
                Terms
              </Link>{' '}
              ·{' '}
              <Link to="/privacy" className="underline underline-offset-2">
                Privacy
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => tour.start()}>
              <Compass /> Show me around
            </Button>
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full" onClick={signOut}>
          <LogOut /> Sign out
        </Button>
      </div>
    </>
  )
}
