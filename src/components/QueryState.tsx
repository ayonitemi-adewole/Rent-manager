import { CloudOff, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { friendlyError } from '@/lib/errors'

type Props = { isPending: boolean; error: unknown; refetch?: () => void }

/** Renders placeholders or an error for a query; returns null once data is ready. */
export function QueryState({ isPending, error, refetch }: Props) {
  if (error) {
    return (
      <div className="bg-card flex flex-col items-center gap-3 rounded-xl border p-6 text-center motion-safe:animate-enter">
        <span className="bg-muted text-muted-foreground grid size-11 place-items-center rounded-full">
          <CloudOff className="size-5" />
        </span>
        <p className="max-w-xs text-sm">{friendlyError(error)}</p>
        {refetch && (
          <Button variant="outline" onClick={() => refetch()}>
            <RotateCw /> Try again
          </Button>
        )}
      </div>
    )
  }
  if (isPending) {
    return (
      <div className="space-y-4 py-2 motion-safe:animate-enter-late" role="status" aria-label="Loading">
        {[0.62, 0.48, 0.55].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5" style={{ width: `${w * 100}%` }} />
              <Skeleton className="h-3" style={{ width: `${w * 70}%` }} />
            </div>
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    )
  }
  return null
}
