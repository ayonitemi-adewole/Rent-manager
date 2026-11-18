import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { TourContext } from './tour-context'
import { TourOverlay } from './TourOverlay'
import { isTourActive, setTourActive } from './tour-storage'

/** Onboarding calls setTourActive(true) before sending a new landlord here, so the guide opens straight away. */
export function TourProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(isTourActive)

  const start = useCallback(() => {
    setTourActive(true)
    setActive(true)
  }, [])
  const stop = useCallback(() => {
    setTourActive(false)
    setActive(false)
  }, [])

  const value = useMemo(() => ({ active, start, stop }), [active, start, stop])
  return (
    <TourContext value={value}>
      {children}
      {active && <TourOverlay onClose={stop} />}
    </TourContext>
  )
}
