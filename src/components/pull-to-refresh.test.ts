import { describe, expect, it } from 'vitest'
import { MAX_PULL, PULL_THRESHOLD, REFRESH_HOLD, resist } from './pull-to-refresh'

describe('resist', () => {
  it('does nothing for no or upward travel', () => {
    expect(resist(0)).toBe(0)
    expect(resist(-50)).toBe(0)
  })

  it('follows the finger closely at first, then stiffens', () => {
    expect(resist(10)).toBeGreaterThan(9)
    expect(resist(200) - resist(150)).toBeLessThan(resist(50) - resist(0))
  })

  it('keeps growing but never passes MAX_PULL', () => {
    let last = 0
    for (const travel of [20, 60, 120, 240, 480, 2000]) {
      const pull = resist(travel)
      expect(pull).toBeGreaterThan(last)
      expect(pull).toBeLessThan(MAX_PULL)
      last = pull
    }
  })

  it('reaches the refresh point with a comfortable thumb movement', () => {
    expect(resist(100)).toBeLessThan(PULL_THRESHOLD) // a small tug doesn't refresh
    expect(resist(160)).toBeGreaterThanOrEqual(PULL_THRESHOLD)
  })

  it('holds the content below the refresh point while refreshing', () => {
    expect(REFRESH_HOLD).toBeLessThan(PULL_THRESHOLD)
  })
})
