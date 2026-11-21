import { Check, Compass } from 'lucide-react'
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
  const nextId = SETUP_TASKS.find((task) => !task.done(progress))?.id

  return (
    <Card className="border-primary/25 gap-4 py-5">
      <CardContent className="space-y-5">
        <div className="flex items-start gap-3">
          <span className="bg-secondary text-primary grid size-10 shrink-0 place-items-center rounded-lg">
            <Compass className="size-5" />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-bold">Get set up</h2>
              <span className="text-muted-foreground text-xs font-semibold">
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
              <div
                className="bg-primary h-full rounded-full transition-all"
                style={{ width: `${(done / SETUP_TASKS.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <ol className="space-y-1">
          {SETUP_TASKS.map((task, i) => {
            const complete = task.done(progress)
            const next = task.id === nextId
            return (
              <li
                key={task.id}
                aria-current={next ? 'step' : undefined}
                className={cn('flex items-center gap-3 rounded-lg px-2 py-2 text-sm', next && 'bg-secondary/60')}
              >
                <span
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold',
                    complete
                      ? 'bg-success text-background'
                      : next
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {complete ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span
                  className={cn(
                    complete && 'text-muted-foreground line-through',
                    next && 'font-semibold',
                  )}
                >
                  {task.label}
                </span>
                {complete && <span className="sr-only">(done)</span>}
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
