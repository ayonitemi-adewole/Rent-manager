import { formatKobo, formatKoboExact } from '@/lib/money'
import { cn } from '@/lib/utils'

type Props = {
  kobo: number
  /** Show kobo when there are any (fees). */
  exact?: boolean
  className?: string
}

/**
 * An amount with equal-width digits and a smaller ₦, so the figure reads first: "₦350,000".
 * For amounts that stand on their own; inside a sentence, use formatKobo().
 */
export function Money({ kobo, exact = false, className }: Props) {
  const text = exact ? formatKoboExact(kobo) : formatKobo(kobo)
  const at = text.indexOf('₦')
  if (at === -1) return <span className={cn('figure', className)}>{text}</span>
  return (
    <span className={cn('figure whitespace-nowrap', className)}>
      {text.slice(0, at)}
      <span className="mr-[0.06em] align-[0.08em] text-[0.78em] font-semibold opacity-70">₦</span>
      {text.slice(at + 1)}
    </span>
  )
}
