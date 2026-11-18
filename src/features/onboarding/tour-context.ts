import { createContext, useContext } from 'react'

export type TourContextValue = {
  active: boolean
  start: () => void
  stop: () => void
}

export const TourContext = createContext<TourContextValue>({ active: false, start: () => {}, stop: () => {} })

export const useTour = () => useContext(TourContext)
