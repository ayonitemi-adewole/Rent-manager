import { zodResolver } from '@hookform/resolvers/zod'
import { LogOut } from 'lucide-react'
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
import { useLandlord, useSaveLandlord } from '@/features/landlord/api'
import { friendlyError } from '@/lib/errors'
import { formatNgPhone } from '@/lib/phone'

const schema = z.object({ fullName: z.string().trim().min(2, 'Enter your full name').max(100) })

export function SettingsPage() {
  const { signOut } = useAuth()
  const { data: landlord } = useLandlord()
  const save = useSaveLandlord()
  const [saved, setSaved] = useState(false)
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    values: { fullName: landlord?.full_name ?? '' },
  })

  const onSubmit = form.handleSubmit(({ fullName }) =>
    save.mutate({ fullName }, { onSuccess: () => setSaved(true) }),
  )

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
              <Field
                id="fullName"
                label="Name shown to tenants"
                error={form.formState.errors.fullName?.message}
              >
                <Input
                  id="fullName"
                  className="h-11"
                  {...form.register('fullName', { onChange: () => setSaved(false) })}
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
            <Button asChild variant={landlord?.account_number ? 'outline' : 'default'}>
              <Link to="/settings/payout">{landlord?.account_number ? 'Change account' : 'Set up payout account'}</Link>
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
