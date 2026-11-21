// The numbers behind PullToRefresh.tsx, kept apart so they can be tested without a browser.

/** How far the content can be pulled, at most (px). */
export const MAX_PULL = 120
/** Pulled this far (after resistance), letting go refreshes (px): about 115px of finger travel. */
export const PULL_THRESHOLD = 70
/** Where the content waits while refreshing, leaving room for the spinner (px). */
export const REFRESH_HOLD = 56
/** Finger travel before a downward drag counts as a pull, so taps and small wobbles don't (px). */
export const PULL_SLOP = 10
/** Keep the spinner up at least this long, so a fast refresh still reads as one (ms). */
export const MIN_SPIN_MS = 600

/**
 * Finger travel → how far the content moves. 1:1 at first, then stiffer, never past MAX_PULL:
 * the "rubber band" feel of native apps.
 */
export function resist(fingerTravel: number): number {
  if (fingerTravel <= 0) return 0
  return MAX_PULL * (1 - Math.exp(-fingerTravel / MAX_PULL))
}

/** Where the spinner sits for a given pull: centred in the gap the content leaves (px from the top). */
export const indicatorOffset = (pull: number) => pull / 2 - 20
