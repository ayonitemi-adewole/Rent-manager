import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router'
import { z } from 'zod'
import { Field, FormError } from '@/components/Field'
import { AuthShell } from '@/components/AuthShell'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-context'
import { setTourActive } from '@/features/onboarding/tour-storage'
import { friendlyError } from '@/lib/errors'
import { needsOnboarding, useCompleteOnboarding, useLandlord } from './api'
import { profileSchema } from './profile-schema'

const schema = profileSchema.extend({
  agree: z.boolean().refine((v) => v, 'Please read and accept to continue'),
})
type FormValues = z.input<typeof schema>

export function OnboardingPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { data: landlord, isPending } = useLandlord()
  const save = useCompleteOnboarding()
  const form = useForm<FormValues, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    values: {
      fullName: landlord?.full_name ?? '',
      displayName: landlord?.display_name ?? '',
      email: landlord?.email ?? '',
      agree: false,
    },
    resetOptions: { keepDirtyValues: true },
  })
  const errors = form.formState.errors
  const [displayName, fullName] = useWatch({ control: form.control, name: ['displayName', 'fullName'] })
  const preview = (displayName ?? '').trim() || (fullName ?? '').trim() || 'your name'

  if (isPending) return <FullPageSpinner />
  if (!needsOnboarding(landlord)) return <Navigate to="/" replace />

  const isNew = !landlord
  const onSubmit = form.handleSubmit((values) =>
    save.mutate(values, {
      onSuccess: () => {
        if (isNew) setTourActive(true) // new landlords go straight into the guided setup
        navigate('/', { replace: true })
      },
    }),
  )

  return (
    <AuthShell>
      <div className="space-y-3">
        <Logo className="lg:hidden" />
        <h1 className="text-2xl font-bold tracking-tight">
          {isNew ? 'Welcome to RentPadi' : 'A few details before you continue'}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isNew
            ? 'Tell us who you are. It takes a minute, then we’ll show you around.'
            : 'We now ask every landlord for an email address and to accept our terms.'}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Field id="fullName" label="Your full name" error={errors.fullName?.message}>
          <Input
            id="fullName"
            autoComplete="name"
            placeholder="e.g. Adebayo Adeyemi"
            className="h-12 text-base"
            autoFocus={isNew}
            {...form.register('fullName')}
          />
        </Field>

        <Field
          id="displayName"
          label="Name tenants see (optional)"
          error={errors.displayName?.message}
          hint={`Tenants will see: “…Pay securely: <link> - ${preview}”`}
        >
          <Input
            id="displayName"
            placeholder="e.g. Adeyemi Properties or Mr Adeyemi"
            className="h-12 text-base"
            {...form.register('displayName')}
          />
        </Field>

        <Field
          id="email"
          label="Email address"
          error={errors.email?.message}
          hint="For your payout account and important notices. Never shown to tenants."
        >
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="name@gmail.com"
            className="h-12 text-base"
            autoFocus={!isNew}
            {...form.register('email')}
          />
        </Field>

        <div className="space-y-2">
          <label htmlFor="agree" className="flex items-start gap-3 text-sm">
            <input
              id="agree"
              type="checkbox"
              className="accent-primary mt-0.5 size-5 shrink-0"
              aria-invalid={Boolean(errors.agree)}
              {...form.register('agree')}
            />
            <span>
              I agree to the{' '}
              <Link to="/terms" target="_blank" className="text-primary underline underline-offset-2">
                Terms of use
              </Link>{' '}
              and{' '}
              <Link to="/privacy" target="_blank" className="text-primary underline underline-offset-2">
                Privacy notice
              </Link>
              , and I’ll let my tenants know RentPadi sends their rent reminders and receipts.
            </span>
          </label>
          {errors.agree && <p className="text-destructive text-sm">{errors.agree.message}</p>}
        </div>

        <FormError message={save.error ? friendlyError(save.error) : null} />
        <Button type="submit" className="h-12 w-full text-base" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Continue'}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={signOut}>
          Sign out
        </Button>
      </form>
    </AuthShell>
  )
}
