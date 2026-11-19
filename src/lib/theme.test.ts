import { describe, expect, it } from 'vitest'
import { parseThemePref, resolveDark } from './theme'

describe('theme', () => {
  it('anything but light or dark means follow the device', () => {
    expect([parseThemePref('light'), parseThemePref('dark')]).toEqual(['light', 'dark'])
    expect([parseThemePref(null), parseThemePref(''), parseThemePref('blue')]).toEqual(['system', 'system', 'system'])
  })
  it('device follows the system; light and dark override it', () => {
    expect(resolveDark('system', true)).toBe(true)
    expect(resolveDark('system', false)).toBe(false)
    expect(resolveDark('light', true)).toBe(false)
    expect(resolveDark('dark', false)).toBe(true)
  })
})
