import { CircleCheck, FlaskConical, MessageSquareText } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/AuthShell'
import { Callout } from '@/components/Callout'
import { FormError } from '@/components/Field'
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
    <AuthShell>
      <div className="space-y-3 text-center">
        <Logo size="lg" className="mb-6 justify-center lg:hidden" />
        <h1 className="text-2xl font-bold lg:text-3xl">{step.kind === 'phone' ? 'Sign in' : 'Check your phone'}</h1>
        <p className="text-muted-foreground text-sm">
          {step.kind === 'phone' ? 'Know who has paid. Get rent on time.' : 'Enter the code to finish signing in.'}
        </p>
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
            <p className="text-muted-foreground text-xs leading-relaxed">
              We’ll send a 6-digit code to your WhatsApp or by SMS. No password needed.
            </p>
          </div>
          <FormError message={error} />
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
            <Label htmlFor="code" className="leading-snug">
              6-digit code sent to <span className="figure">{formatNgPhone(step.phone)}</span>
            </Label>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              className="figure h-14 text-center text-2xl font-semibold tracking-[0.5em] placeholder:tracking-[0.5em] md:text-2xl"
              autoFocus
            />
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <MessageSquareText className="size-3.5 shrink-0" aria-hidden="true" />
              Check WhatsApp for a message from RentPadi, or your SMS.
            </p>
          </div>
          <FormError message={error} />
          {notice && !error && (
            <Callout role="status" tone="success" icon={CircleCheck}>
              {notice}
            </Callout>
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
        <Callout tone="info" icon={FlaskConical} className="text-xs">
          Demo mode: while the Send SMS hook points at <strong>dev_send_sms_hook</strong>, no message is sent. Find your
          code in Supabase → Table Editor → <strong>dev_sms_outbox</strong>, or use a test number you set up under the
          Phone provider.
        </Callout>
      )}
    </AuthShell>
  )
}
