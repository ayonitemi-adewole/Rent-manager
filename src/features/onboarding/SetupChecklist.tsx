import { CheckCircle2, Circle, Compass } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useTour } from './tour-context'
import { doneCount, SETUP_TASKS } from './tour-steps'
import { useSetupProgress } from './useSetupProgress'

const hiddenKey = (landlordId: string) => `rentpadi.setup.hidden.${landlordId}`
const isHidden = (landlordId: string) => {
  try {
    return localStorage.getItem(hiddenKey(landlordId)) === '1'
  } catch {
    return false
  }
}

/** Dashboard card until setup is complete. Shows `fallback` once it's done or hidden. */
export function SetupChecklist({ landlordId, fallback = null }: { landlordId: string; fallback?: ReactNode }) {
  const progress = useSetupProgress()
  const tour = useTour()
  const [hidden, setHidden] = useState(() => isHidden(landlordId))

  if (!progress) return null
  const done = doneCount(progress)
  if (hidden || done === SETUP_TASKS.length) return fallback

  const hide = () => {
    try {
      localStorage.setItem(hiddenKey(landlordId), '1')
    } catch {
      // Hidden for this visit only.
    }
    setHidden(true)
  }

  return (
    <Card className="border-primary/30 gap-4 py-4">
      <CardContent className="space-y-4 px-4">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold">Get set up</h2>
            <span className="text-muted-foreground text-xs">
              {done} of {SETUP_TASKS.length} done
            </span>
          </div>
          <div
            className="bg-muted h-1.5 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={SETUP_TASKS.length}
            aria-valuenow={done}
            aria-label="Setup progress"
          >
            <div className="bg-primary h-full transition-all" style={{ width: `${(done / SETUP_TASKS.length) * 100}%` }} />
          </div>
        </div>

        <ol className="space-y-2.5">
          {SETUP_TASKS.map((task) => {
            const complete = task.done(progress)
            const Icon = complete ? CheckCircle2 : Circle
            return (
              <li key={task.id} className="flex items-center gap-2.5 text-sm">
                <Icon className={cn('size-5 shrink-0', complete ? 'text-success' : 'text-muted-foreground')} />
                <span className={cn(complete && 'text-muted-foreground line-through')}>{task.label}</span>
              </li>
            )
          })}
        </ol>

        <div className="flex items-center gap-3">
          <Button className="flex-1" onClick={tour.start}>
            <Compass /> Show me how
          </Button>
          <Button variant="ghost" onClick={hide}>
            Hide
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
