import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 text-xl font-bold tracking-tight', className)}>
      <span className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-lg text-base">
        RP
      </span>
      <span>
        Rent<span className="text-primary">Padi</span>
      </span>
    </div>
  )
}
