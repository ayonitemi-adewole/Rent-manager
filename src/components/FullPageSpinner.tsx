import { Loader2 } from 'lucide-react'

export function FullPageSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Loading">
      <Loader2 className="text-primary size-8 animate-spin" />
    </div>
  )
}
