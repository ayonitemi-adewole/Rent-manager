import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabase'
import { formatNgPhone, normalizeNgPhone } from '@/lib/phone'
import { useAuth } from './auth-context'

type Step = { kind: 'phone' } | { kind: 'code'; phone: string }

export function LoginPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [step, setStep] = useState<Step>({ kind: 'phone' })
  const [phoneInput, setPhoneInput] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to={from} replace />

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const phone = normalizeNgPhone(phoneInput)
    if (!phone) {
      setError('Enter a valid Nigerian phone number, e.g. 0803 123 4567')
      return
    }
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({ phone })
    setBusy(false)
    if (error) setError(error.message)
    else setStep({ kind: 'code', phone })
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    if (step.kind !== 'code') return
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.verifyOtp({ phone: step.phone, token: code, type: 'sms' })
    setBusy(false)
    if (error) setError(error.message)
    else navigate(from, { replace: true })
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="space-y-2 text-center">
        <Logo className="justify-center" />
        <p className="text-muted-foreground text-sm">Know who has paid. Get rent on time.</p>
      </div>

      {step.kind === 'phone' ? (
        <form onSubmit={sendCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0803 123 4567"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="h-12 text-base"
              autoFocus
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
            {busy ? 'Sending code…' : 'Send code'}
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Enter the 6-digit code sent to {formatNgPhone(step.phone)}</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              className="h-12 text-center text-lg tracking-[0.5em]"
              autoFocus
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          <Button type="submit" className="h-12 w-full text-base" disabled={busy || code.length !== 6}>
            {busy ? 'Checking…' : 'Sign in'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setStep({ kind: 'phone' })
              setCode('')
              setError(null)
            }}
          >
            Use a different number
          </Button>
        </form>
      )}

      {import.meta.env.DEV && (
        <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
          Demo mode: no SMS is sent. Find your code in Supabase → Table Editor →{' '}
          <strong>dev_sms_outbox</strong>, or use a test number you set up under the Phone provider.
        </p>
      )}
    </main>
  )
}
