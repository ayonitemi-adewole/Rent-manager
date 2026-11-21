import { useQueryClient } from '@tanstack/react-query'
import { ArrowDown, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
  indicatorOffset,
  MIN_SPIN_MS,
  PULL_SLOP,
  PULL_THRESHOLD,
  REFRESH_HOLD,
  resist,
} from './pull-to-refresh'

type Phase = 'idle' | 'pulling' | 'ready' | 'refreshing'

type Props = {
  children: ReactNode
  /** On the outer element (e.g. to fill the space below a header). */
  className?: string
  /** On the element that moves with the finger. */
  contentClassName?: string
}

/**
 * Pull down at the top of the page to refetch everything on it (every active query). Touch only;
 * computers refetch when the window regains focus anyway.
 *
 * Only what's inside moves: put headers and tab bars outside it and they stay put. While mounted,
 * the browser's own pull-to-reload and top bounce are off (html.pull-to-refresh in index.css), so
 * the listeners stay passive and never slow down ordinary scrolling.
 */
export function PullToRefresh({ children, className, contentClassName }: Props) {
  const queryClient = useQueryClient()
  const root = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const indicator = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const phaseRef = useRef<Phase>('idle')

  useEffect(() => {
    const el = root.current
    if (!el) return
    const html = document.documentElement
    html.classList.add('pull-to-refresh')
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const go = (next: Phase) => {
      if (phaseRef.current === next) return
      phaseRef.current = next
      setPhase(next)
    }

    /** Moves the content and the spinner; straight from the finger, or animated when let go. */
    const paint = (pull: number, animate: boolean) => {
      const c = content.current
      const i = indicator.current
      if (!c || !i) return
      const transition = animate && !reduceMotion.matches ? '0.22s cubic-bezier(0.2, 0, 0, 1)' : ''
      c.style.transition = transition && `transform ${transition}`
      // No transform at rest: a transformed parent would change how position: fixed works inside.
      c.style.transform = pull > 0 ? `translate3d(0, ${pull}px, 0)` : ''
      i.style.transition = transition && `transform ${transition}, opacity ${transition}`
      i.style.transform = `translate3d(-50%, ${indicatorOffset(pull)}px, 0)`
      i.style.opacity = String(Math.min(1, pull / PULL_THRESHOLD))
      i.style.setProperty('--pull', String(Math.min(1, pull / PULL_THRESHOLD)))
    }

    let tracking = false
    let pulling = false
    let startX = 0
    let startY = 0
    let pull = 0

    const atTop = () => window.scrollY <= 0

    const onStart = (e: TouchEvent) => {
      tracking = false
      if (phaseRef.current === 'refreshing' || e.touches.length !== 1 || !atTop()) return
      // Not from inside dialogs (the guided tour) or anything marked data-no-pull.
      if ((e.target as Element | null)?.closest('[role="dialog"], [data-no-pull]')) return
      tracking = true
      pulling = false
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }

    const onMove = (e: TouchEvent) => {
      if (!tracking) return
      const t = e.touches[0]
      if (!pulling) {
        const dx = t.clientX - startX
        const dy = t.clientY - startY
        // Sideways or upwards first: a swipe or a scroll, not a pull.
        if (Math.abs(dx) > PULL_SLOP || dy < -PULL_SLOP) {
          tracking = false
          return
        }
        if (dy < PULL_SLOP || !atTop()) return
        pulling = true
        startY = t.clientY // count from here, so the content doesn't jump
        go('pulling')
      }
      pull = resist(t.clientY - startY)
      paint(pull, false)
      go(pull >= PULL_THRESHOLD ? 'ready' : 'pulling')
    }

    const onEnd = () => {
      const wasPulling = tracking && pulling
      tracking = false
      pulling = false
      if (!wasPulling) return
      if (pull < PULL_THRESHOLD) {
        go('idle')
        paint(0, true)
        return
      }
      go('refreshing')
      paint(REFRESH_HOLD, true)
      const wait = new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS))
      void Promise.all([queryClient.refetchQueries({ type: 'active' }), wait]).finally(() => {
        go('idle')
        paint(0, true)
      })
    }

    paint(0, false)
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      html.classList.remove('pull-to-refresh')
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [queryClient])

  return (
    <div ref={root} className={cn('relative', className)}>
      <div
        ref={indicator}
        aria-hidden="true"
        className="bg-card text-primary shadow-float pointer-events-none absolute top-0 left-1/2 z-0 grid size-10 place-items-center rounded-full border opacity-0"
      >
        {phase === 'refreshing' ? (
          <Loader2 className="size-5 animate-spin motion-reduce:animate-[spin_2.4s_linear_infinite]" />
        ) : (
          // Turns from pointing down to pointing up as the pull reaches the refresh point (--pull: 0 → 1).
          <ArrowDown
            className="size-5"
            strokeWidth={2.5}
            style={{ transform: 'rotate(calc(var(--pull, 0) * 180deg))' }}
          />
        )}
      </div>
      <span role="status" className="sr-only">
        {phase === 'refreshing' ? 'Refreshing…' : ''}
      </span>
      <div ref={content} className={contentClassName}>
        {children}
      </div>
    </div>
  )
}
