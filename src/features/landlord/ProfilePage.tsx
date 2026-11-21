import { zodResolver } from '@hookform/resolvers/zod'
import { Check, LogOut, Phone } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Avatar } from '@/components/Avatar'
import { Field, FormError, FormSection } from '@/components/Field'
import { PageHeader } from '@/components/PageHeader'
import { QueryState } from '@/components/QueryState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { friendlyError } from '@/lib/errors'
import { formatNgPhone } from '@/lib/phone'
import { useLandlord, useUpdateProfile } from './api'
import { profileSchema, type ProfileForm } from './profile-schema'

/** The landlord's own details: who they are, the name tenants see, their email. And signing out. */
export function ProfilePage() {
  const { signOut } = useAuth()
  const { data: landlord, isPending, error, refetch } = useLandlord()
  const save = useUpdateProfile()
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
  // Same name as the sidebar and header, so the initials match everywhere.
  const shownName = landlord?.display_name || landlord?.full_name || ''

  return (
    <>
      <PageHeader title="Your profile" />
      <QueryState isPending={isPending} error={error} refetch={refetch} />

      {landlord && (
        <div className="space-y-4">
          <div className="bg-card shadow-card flex items-center gap-4 rounded-xl border border-border/80 p-4 sm:p-5">
            <Avatar name={shownName} size="lg" />
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-lg font-bold">{shownName}</p>
              {landlord.display_name && landlord.full_name && (
                <p className="text-muted-foreground truncate text-sm">{landlord.full_name}</p>
              )}
              <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="figure">{formatNgPhone(landlord.phone)}</span>
                <span className="sr-only">(the number you sign in with)</span>
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormSection title="Your details" description="You sign in with your phone number and a code, so there’s no password to change.">
              <Field id="fullName" label="Your full name" error={errors.fullName?.message}>
                <Input id="fullName" autoComplete="name" className="h-12 text-base" {...form.register('fullName', unsave)} />
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
                  className="h-12 text-base"
                  {...form.register('displayName', unsave)}
                />
              </Field>
              <Field id="email" label="Email address" error={errors.email?.message} hint="Never shown to tenants.">
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  className="h-12 text-base"
                  {...form.register('email', unsave)}
                />
              </Field>
            </FormSection>
            <FormError message={save.error ? friendlyError(save.error) : null} />
            <Button type="submit" className="h-12 w-full text-base" disabled={save.isPending}>
              {save.isPending ? (
                'Saving…'
              ) : saved ? (
                <>
                  <Check /> Saved
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </form>

          <div className="mt-6 border-t border-dashed pt-6">
            <Button variant="outline" className="text-destructive hover:text-destructive h-11 w-full" onClick={signOut}>
              <LogOut /> Sign out
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
