import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router'
import { z } from 'zod'
import { Field, FormError } from '@/components/Field'
import { FullPageSpinner } from '@/components/FullPageSpinner'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { friendlyError } from '@/lib/errors'
import { useLandlord, useSaveLandlord } from './api'

const schema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name').max(100),
})
type FormValues = z.infer<typeof schema>

export function OnboardingPage() {
  const navigate = useNavigate()
  const { data: landlord, isPending } = useLandlord()
  const save = useSaveLandlord()
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { fullName: '' } })

  if (isPending) return <FullPageSpinner />
  if (landlord) return <Navigate to="/" replace />

  const onSubmit = form.handleSubmit(({ fullName }) =>
    save.mutate({ fullName }, { onSuccess: () => navigate('/properties/new', { replace: true }) }),
  )

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="space-y-3">
        <Logo />
        <h1 className="text-2xl font-bold tracking-tight">Welcome to RentPadi</h1>
        <p className="text-muted-foreground text-sm">
          Your name appears on reminders and receipts, so tenants know the message is from you.
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field id="fullName" label="Your full name" error={form.formState.errors.fullName?.message}>
          <Input
            id="fullName"
            autoComplete="name"
            placeholder="e.g. Mr Adebayo Adeyemi"
            className="h-12 text-base"
            autoFocus
            {...form.register('fullName')}
          />
        </Field>
        <FormError message={save.error ? friendlyError(save.error) : null} />
        <Button type="submit" className="h-12 w-full text-base" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Continue'}
        </Button>
      </form>
    </main>
  )
}
