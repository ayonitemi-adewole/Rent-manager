import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { Logo, LogoMark } from '@/components/Logo'

const POINTS = [
  'Tenants reminded on WhatsApp and SMS, before rent is due',
  'Rent paid by link, straight into your own bank account',
  'A numbered receipt for every payment, online or cash',
]

/**
 * Login and first-time setup. Phones: the form on a soft brand glow. Large screens: a brand panel
 * on the left, so the page doesn't feel like a phone screen stretched across a monitor.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="brand-surface relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col xl:p-16">
        <Logo tone="onBrand" />
        <div className="relative z-10 my-auto max-w-md space-y-7 py-12">
          <h2 className="text-4xl leading-tight font-bold xl:text-5xl">
            Stop chasing rent. <span className="text-brand-gold">Let it come to you.</span>
          </h2>
          <ul className="space-y-3.5 text-white/85">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3">
                <span className="bg-brand-gold text-brand mt-0.5 grid size-5 shrink-0 place-items-center rounded-full">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative z-10 flex items-center gap-2 text-sm text-white/65">
          <span aria-hidden="true" className="bg-brand-gold size-2 rounded-full" />
          Made in Ibadan, for landlords across Nigeria.
        </p>
        <LogoMark
          size={420}
          tone="onBrand"
          className="pointer-events-none absolute -right-24 -bottom-16 rotate-[-8deg] opacity-[0.08]"
        />
      </aside>

      <div className="auth-glow lg:bg-none">
        <main className="motion-safe:animate-enter mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
          {children}
        </main>
      </div>
    </div>
  )
}
