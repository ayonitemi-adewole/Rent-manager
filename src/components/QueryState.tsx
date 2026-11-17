import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { friendlyError } from '@/lib/errors'

type Props = { isPending: boolean; error: unknown; refetch?: () => void }

/** Renders a spinner or error for a query; returns null once data is ready. */
export function QueryState({ isPending, error, refetch }: Props) {
  if (error) {
    return (
      <div className="space-y-3 rounded-xl border p-6 text-center">
        <p className="text-sm">{friendlyError(error)}</p>
        {refetch && (
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        )}
      </div>
    )
  }
  if (isPending) {
    return (
      <div className="grid place-items-center py-16" role="status" aria-label="Loading">
        <Loader2 className="text-primary size-6 animate-spin" />
      </div>
    )
  }
  return null
}
