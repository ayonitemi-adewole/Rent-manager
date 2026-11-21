import { PartyPopper, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { holeFor, placeCard, type Box } from './tour-geometry'
import { tourPosition, type TourTarget } from './tour-steps'
import { useSetupProgress } from './useSetupProgress'

/** First visible element marked data-tour="<target>" (pages can have two, e.g. header and empty state). */
function findTarget(target: TourTarget): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

const sameBox = (a: Box | null, b: Box | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    Math.round(a.top) === Math.round(b.top) &&
    Math.round(a.left) === Math.round(b.left) &&
    Math.round(a.width) === Math.round(b.width) &&
    Math.round(a.height) === Math.round(b.height))

/**
 * Follows the target every frame (scrolling, layout shifts, data arriving).
 * `pinnedOffset`: for pinned cards, how far below the top of the screen the target should start.
 */
function useTargetBox(target: TourTarget | null, pinnedOffset: number | null): { box: Box | null; missing: boolean } {
  const [box, setBox] = useState<Box | null>(null)
  const [missing, setMissing] = useState(false)
  const offset = useRef(pinnedOffset)
  useEffect(() => {
    offset.current = pinnedOffset
  }, [pinnedOffset])

  useEffect(() => {
    if (!target) return
    let frame = 0
    let scrolledTo: HTMLElement | null = null
    const startedAt = performance.now()

    const tick = () => {
      const el = findTarget(target)
      if (el && el !== scrolledTo) {
        scrolledTo = el
        const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
        if (offset.current !== null) {
          // Start the form just below the pinned card so it doesn't cover the first field.
          const y = el.getBoundingClientRect().top + window.scrollY - offset.current
          window.scrollTo({ top: Math.max(y, 0), behavior })
        } else {
          el.scrollIntoView({ block: 'center', behavior })
        }
      }
      const r = el?.getBoundingClientRect()
      const next = r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null
      setBox((prev) => (sameBox(prev, next) ? prev : next))
      // Not on this page after a moment (e.g. still loading, or hidden): show the card without a spotlight.
      setMissing(!el && performance.now() - startedAt > 1200)
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [target])

  return { box, missing }
}

function useViewport() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

export function TourOverlay({ onClose }: { onClose: () => void }) {
  const progress = useSetupProgress()
  const { pathname } = useLocation()
  const position = progress ? tourPosition(progress, pathname) : null
  const step = position?.kind === 'step' ? position.step : null

  const viewport = useViewport()
  const [cardEl, setCardEl] = useState<HTMLDivElement | null>(null)
  const [cardHeight, setCardHeight] = useState(170)
  const { box, missing } = useTargetBox(step?.target ?? null, step?.pinned ? cardHeight + 24 : null)
  const [nudge, setNudge] = useState(0)

  // The card's height decides whether it fits above or below the target.
  useEffect(() => {
    if (!cardEl) return
    const observer = new ResizeObserver(() => setCardHeight(cardEl.offsetHeight))
    observer.observe(cardEl)
    return () => observer.disconnect()
  }, [cardEl])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!position) return null

  if (position.kind === 'finished') {
    return (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4">
        <div
          role="dialog"
          aria-labelledby="tour-title"
          className="bg-card text-card-foreground shadow-float w-full max-w-sm space-y-3 rounded-2xl border p-6 text-center motion-safe:animate-enter"
        >
          <span className="bg-secondary text-primary mx-auto grid size-14 -rotate-6 place-items-center rounded-2xl">
            <PartyPopper className="size-7 rotate-6" />
          </span>
          <h2 id="tour-title" className="text-lg font-bold">
            You’re all set
          </h2>
          <p className="text-muted-foreground text-sm">
            RentPadi will remind your tenants before rent is due and send receipts when they pay. Check the dashboard
            to see who owes.
          </p>
          <Button className="w-full" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    )
  }

  const { step: s, taskIndex, total } = position
  const hole = box && !missing ? holeFor(box) : null
  const card = placeCard(hole, viewport, cardHeight, s.pinned)
  const blocked = () => setNudge((n) => n + 1)

  // Four invisible panels around the hole catch taps; the hole itself stays usable.
  const blockers: CSSProperties[] = hole
    ? [
        { top: 0, left: 0, right: 0, height: Math.max(hole.top, 0) },
        { top: hole.top + hole.height, left: 0, right: 0, bottom: 0 },
        { top: hole.top, left: 0, width: Math.max(hole.left, 0), height: hole.height },
        { top: hole.top, left: hole.left + hole.width, right: 0, height: hole.height },
      ]
    : []

  return (
    <>
      {hole && (
        <>
          <div
            aria-hidden
            className="tour-spotlight ring-gold pointer-events-none fixed z-[60] rounded-xl ring-[3px]"
            style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
          />
          {blockers.map((style, i) => (
            <div key={i} aria-hidden className="fixed z-[60]" style={style} onClick={blocked} />
          ))}
        </>
      )}

      <div
        ref={setCardEl}
        key={nudge}
        role="dialog"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        className={cn(
          'bg-card text-card-foreground shadow-float fixed z-[61] rounded-2xl border p-4',
          nudge > 0 && 'tour-nudge',
        )}
        style={{ top: card.top, bottom: card.bottom, left: card.left, width: card.width }}
      >
        {card.arrow && (
          <span
            aria-hidden
            className={cn(
              'bg-card absolute size-3 rotate-45 border',
              card.arrow.side === 'top' ? '-top-1.5 border-r-0 border-b-0' : '-bottom-1.5 border-t-0 border-l-0',
            )}
            style={{ left: card.arrow.x - 6 }}
          />
        )}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1" aria-live="polite">
            <p className="text-primary text-xs font-bold">
              Step {taskIndex + 1} of {total}
            </p>
            <h2 id="tour-title" className="font-bold">
              {s.title}
            </h2>
            <p id="tour-body" className="text-muted-foreground text-sm">
              {s.body}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="-mt-1 -mr-2 shrink-0" aria-label="Close guide" onClick={onClose}>
            <X />
          </Button>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex gap-1" aria-hidden>
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={cn('h-1.5 w-5 rounded-full', i <= taskIndex ? 'bg-primary' : 'bg-muted')}
              />
            ))}
          </div>
          <button type="button" className="text-muted-foreground text-xs underline underline-offset-2" onClick={onClose}>
            Skip the guide
          </button>
        </div>
      </div>
    </>
  )
}
