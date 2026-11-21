import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = { icon: LucideIcon; title: string; description: string; action?: ReactNode }

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="bg-card flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      {/* A tilted tile with a gold "coin": the brand mark's idea, in miniature. */}
      <div className="relative mb-1">
        <div className="bg-secondary text-primary grid size-14 -rotate-6 place-items-center rounded-2xl">
          <Icon className="size-7 rotate-6" />
        </div>
        <span aria-hidden="true" className="bg-gold ring-card absolute -top-1 -right-1 size-4 rounded-full ring-4" />
      </div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-muted-foreground max-w-xs text-sm">{description}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
