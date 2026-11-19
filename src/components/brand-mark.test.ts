import { describe, expect, it } from 'vitest'
import { appIconSvg, detailForSize, markSvg, ON_LIGHT } from './brand-mark'

describe('brand mark', () => {
  it('draws less detail as it gets smaller', () => {
    expect([detailForSize(16), detailForSize(31), detailForSize(32), detailForSize(63), detailForSize(64)]).toEqual([
      'small',
      'small',
      'medium',
      'medium',
      'full',
    ])
  })

  it('full: cuff, sparkle, coin ring and ₦', () => {
    const svg = markSvg('full', ON_LIGHT)
    expect(svg).toContain('<rect')
    expect(svg).toContain('M110 16 V24') // sparkle
    expect(svg.match(/<circle/g)).toHaveLength(2) // coin + ring
    expect(svg).toContain('M-8 11 V-11') // ₦
  })

  it('medium: no sparkle or ring, thicker ₦', () => {
    const svg = markSvg('medium', ON_LIGHT)
    expect(svg).not.toContain('M110 16 V24')
    expect(svg.match(/<circle/g)).toHaveLength(1)
    expect(svg).toContain('stroke-width="5"')
  })

  it('small: one hand shape and a plain, bigger coin', () => {
    const svg = markSvg('small', ON_LIGHT)
    expect(svg).not.toContain('<rect')
    expect(svg).not.toContain('M-8 11 V-11')
    expect(svg).toContain('r="36"')
  })

  it('app icon: rounded tile by default, square for iOS and maskable', () => {
    expect(appIconSvg()).toContain('rx="45"')
    expect(appIconSvg({ rounded: false })).toContain('rx="0"')
    // Maskable: the mark shrinks towards the centre.
    expect(appIconSvg({ rounded: false, safeZone: 0.8 })).toMatch(/scale\(0\.62/)
  })
})
