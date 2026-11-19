import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logo } from '@/components/Logo'
import { supabase } from '@/lib/supabase'
import { formatNgPhone, normalizeNgPhone } from '@/lib/phone'
import { useAuth } from './auth-context'
import { friendlyAuthError } from './auth-errors'

type Step = { kind: 'phone' } | { kind: 'code'; phone: string }

/** Seconds before another code can be requested. */
const RESEND_AFTER = 60

export function LoginPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [step, setStep] = useState<Step>({ kind: 'phone' })
  const [phoneInput, setPhoneInput] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [resendIn])

  if (session) return <Navigate to={from} replace />

  async function requestCode(phone: string) {
    setError(null)
    setNotice(null)
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({ phone })
    setBusy(false)
    if (error) {
      setError(friendlyAuthError(error))
      return false
    }
    setResendIn(RESEND_AFTER)
    return true
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    const phone = normalizeNgPhone(phoneInput)
    if (!phone) {
      setError('Enter a valid Nigerian phone number, e.g. 0803 123 4567')
      return
    }
    if (await requestCode(phone)) setStep({ kind: 'code', phone })
  }

  async function resend() {
    if (step.kind !== 'code') return
    setCode('')
    if (await requestCode(step.phone)) setNotice(`New code sent to ${formatNgPhone(step.phone)}.`)
  }

  async function verify(token: string) {
    if (step.kind !== 'code' || busy) return
    setError(null)
    setNotice(null)
    setBusy(true)
    const { error } = await supabase.auth.verifyOtp({ phone: step.phone, token, type: 'sms' })
    setBusy(false)
    if (error) {
      setError(friendlyAuthError(error))
      setCode('')
    } else {
      navigate(from, { replace: true })
    }
  }

  function onCodeChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6)
    setCode(digits)
    if (digits.length === 6) void verify(digits) // also covers pasting the code (WhatsApp's copy-code button or the SMS)
  }

  return (
    <main className="motion-safe:animate-enter mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <div className="space-y-2 text-center">
        <Logo size="lg" className="justify-center" />
        <p className="text-muted-foreground text-sm">Know who has paid. Get rent on time.</p>
      </div>

      {step.kind === 'phone' ? (
        <form onSubmit={sendCode} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="phone">Your phone number</Label>
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
            <p className="text-muted-foreground text-xs">
              We’ll send a 6-digit code to your WhatsApp or by SMS. No password needed.
            </p>
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
            {busy ? 'Sending code…' : 'Send code'}
          </Button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void verify(code)
          }}
          className="space-y-4 motion-safe:animate-enter"
          noValidate
        >
          <div className="space-y-2">
            <Label htmlFor="code">Enter the 6-digit code sent to {formatNgPhone(step.phone)}</Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              className="h-12 text-center text-lg tracking-[0.5em]"
              autoFocus
            />
            <p className="text-muted-foreground text-xs">Check WhatsApp for a message from RentPadi, or your SMS.</p>
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          {notice && !error && (
            <p role="status" className="text-success text-sm">
              {notice}
            </p>
          )}
          <Button type="submit" className="h-12 w-full text-base" disabled={busy || code.length !== 6}>
            {busy ? 'Checking…' : 'Sign in'}
          </Button>
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep({ kind: 'phone' })
                setCode('')
                setError(null)
                setNotice(null)
              }}
            >
              Change number
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={busy || resendIn > 0} onClick={resend}>
              {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            </Button>
          </div>
        </form>
      )}

      <p className="text-muted-foreground text-center text-xs">
        By continuing you agree to RentPadi’s{' '}
        <Link to="/terms" className="underline underline-offset-2">
          Terms
        </Link>{' '}
        and{' '}
        <Link to="/privacy" className="underline underline-offset-2">
          Privacy notice
        </Link>
        .
      </p>

      {import.meta.env.DEV && (
        <p className="text-muted-foreground rounded-md border border-dashed p-3 text-xs">
          Demo mode: while the Send SMS hook points at <strong>dev_send_sms_hook</strong>, no message is sent. Find your
          code in Supabase → Table Editor → <strong>dev_sms_outbox</strong>, or use a test number you set up under the
          Phone provider.
        </p>
      )}
    </main>
  )
}
