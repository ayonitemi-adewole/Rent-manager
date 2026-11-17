import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = { icon: LucideIcon; title: string; description: string; action?: ReactNode }

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      <div className="bg-secondary text-secondary-foreground grid size-12 place-items-center rounded-full">
        <Icon className="size-6" />
      </div>
      <h2 className="font-semibold">{title}</h2>
      <p className="text-muted-foreground max-w-xs text-sm">{description}</p>
      {action}
    </div>
  )
}
