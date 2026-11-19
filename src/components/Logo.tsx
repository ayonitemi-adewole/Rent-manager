import {
  BRAND,
  detailForSize,
  MARK,
  markSvg,
  ON_GREEN,
  type MarkColors,
  type MarkDetail,
} from '@/components/brand-mark'
import { cn } from '@/lib/utils'

/**
 * - `auto`: follows the theme (green hand on light, white hand on dark); colours in index.css.
 * - `onBrand`: on Padi Green.
 * - `mono`: one colour (currentColor), the ₦ knocked out in the page background.
 */
type Tone = 'auto' | 'onBrand' | 'mono'

const TONES: Record<Tone, MarkColors> = {
  auto: {
    hand: 'var(--logo-hand)',
    cuff: 'var(--logo-cuff)',
    coin: BRAND.gold,
    ring: BRAND.goldRing,
    naira: BRAND.green,
    sparkle: BRAND.gold,
  },
  onBrand: ON_GREEN,
  mono: {
    hand: 'currentColor',
    cuff: 'currentColor',
    coin: 'currentColor',
    ring: 'currentColor',
    naira: 'var(--background)',
    sparkle: 'currentColor',
  },
}

type MarkProps = {
  /** Rendered size in px; picks how much detail to draw. */
  size?: number
  tone?: Tone
  /** Override the automatic detail level. */
  detail?: MarkDetail
  className?: string
}

/** The mark alone: an open palm receiving a naira coin. Decorative (the name is always next to it). */
export function LogoMark({ size = 32, tone = 'auto', detail, className }: MarkProps) {
  return (
    <svg
      width={size}
      height={Math.round((size * 160) / 172)}
      viewBox={MARK.cropViewBox}
      aria-hidden="true"
      className={cn('shrink-0', className)}
      // Static markup from our own constants (shared with the icon generator), not user input.
      dangerouslySetInnerHTML={{ __html: markSvg(detail ?? detailForSize(size), TONES[tone]) }}
    />
  )
}

/** The app icon: the mark on a rounded Padi Green tile. */
export function AppIcon({ size = 40, className }: { size?: number; className?: string }) {
  const { rx, inset, scale } = MARK.tile
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      aria-hidden="true"
      className={cn('shrink-0', className)}
      dangerouslySetInnerHTML={{
        __html:
          `<rect width="200" height="200" rx="${rx}" fill="${BRAND.green}"/>` +
          `<g transform="translate(${inset} ${inset}) scale(${scale})">${markSvg(detailForSize(size * scale), ON_GREEN)}</g>`,
      }}
    />
  )
}

const SIZES = {
  sm: { mark: 28, text: 'text-lg' },
  md: { mark: 36, text: 'text-xl' },
  lg: { mark: 64, text: 'text-4xl' },
} as const

/** "Rent Padi": Medium + ExtraBold Plus Jakarta Sans, as in the brand sheet. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('font-brand text-logo leading-none tracking-[-0.025em] whitespace-nowrap', className)}>
      <span className="font-medium">Rent</span> <span className="font-extrabold">Padi</span>
    </span>
  )
}

/** The full logo: mark + name. */
export function Logo({
  size = 'md',
  tone = 'auto',
  className,
}: {
  size?: keyof typeof SIZES
  tone?: Exclude<Tone, 'mono'>
  className?: string
}) {
  const s = SIZES[size]
  return (
    <div className={cn('flex items-center gap-2', size === 'lg' && 'gap-3', className)}>
      <LogoMark size={s.mark} tone={tone} />
      <Wordmark className={cn(s.text, tone === 'onBrand' && 'text-white')} />
    </div>
  )
}
