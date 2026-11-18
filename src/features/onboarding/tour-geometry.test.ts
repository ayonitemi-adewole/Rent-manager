import { describe, expect, it } from 'vitest'
import { holeFor, placeCard } from './tour-geometry'

const phone = { width: 390, height: 800 }

describe('placeCard', () => {
  it('goes below a button near the top, pointing at it', () => {
    const p = placeCard({ top: 80, left: 300, width: 70, height: 36 }, phone, 160)
    expect(p.top).toBe(80 + 36 + 14)
    expect(p.width).toBe(358)
    expect(p.left).toBe(16) // clamped to the gutter
    expect(p.arrow).toEqual({ side: 'top', x: 335 - 16 })
  })

  it('goes above the bottom navigation', () => {
    const p = placeCard({ top: 740, left: 100, width: 90, height: 56 }, phone, 160)
    expect(p.bottom).toBe(800 - 740 + 14)
    expect(p.top).toBeUndefined()
    expect(p.arrow?.side).toBe('bottom')
  })

  it('pins to the top when the target fills the screen', () => {
    const p = placeCard({ top: 100, left: 16, width: 358, height: 650 }, phone, 160)
    expect(p).toEqual({ top: 12, left: 16, width: 358 })
  })

  it('pins pinned steps and centres on wide screens', () => {
    expect(placeCard({ top: 100, left: 0, width: 10, height: 10 }, { width: 1200, height: 900 }, 160, true)).toEqual({
      top: 12,
      left: 420,
      width: 360,
    })
  })

  it('keeps the arrow on the card for targets at the edge', () => {
    const p = placeCard({ top: 100, left: 0, width: 20, height: 20 }, phone, 160)
    expect(p.arrow?.x).toBe(20)
  })

  it('sits at the bottom when the target is not on screen', () => {
    expect(placeCard(null, phone, 160)).toEqual({ bottom: 16, left: 16, width: 358 })
  })
})

describe('holeFor', () => {
  it('pads the target', () => {
    expect(holeFor({ top: 10, left: 20, width: 100, height: 40 })).toEqual({ top: 4, left: 14, width: 112, height: 52 })
  })
})
