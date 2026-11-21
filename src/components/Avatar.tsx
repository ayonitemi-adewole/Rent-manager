import type { CSSProperties } from 'react'
import { cn, initials } from '@/lib/utils'

const SIZES = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
} as const

/** The same name always gets the same hue. */
function avatarHue(name: string): number {
  let h = 0
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.codePointAt(0)!) % 360
  return h
}

/** The landlord's initials on a soft tint (sidebar, phone header). Decorative: the name is always nearby. */
export function Avatar({ name, size = 'md', className }: { name: string; size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('avatar-tint grid shrink-0 place-items-center rounded-full font-bold', SIZES[size], className)}
      style={{ '--avatar-hue': avatarHue(name) } as CSSProperties}
    >
      {initials(name) || '·'}
    </span>
  )
}
