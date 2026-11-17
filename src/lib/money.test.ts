import { describe, expect, it } from 'vitest'
import { formatKobo, parseNairaToKobo } from './money'

describe('parseNairaToKobo', () => {
  it.each([
    ['350000', 35_000_000],
    ['350,000', 35_000_000],
    ['₦350,000', 35_000_000],
    [' 1500 ', 150_000],
    ['1500.5', 150_050],
    ['1500.05', 150_005],
    ['0', 0],
  ])('%s → %i kobo', (input, kobo) => {
    expect(parseNairaToKobo(input)).toBe(kobo)
  })

  it.each(['', 'abc', '-500', '1.234', '1,5a'])('rejects %s', (input) => {
    expect(parseNairaToKobo(input)).toBeNull()
  })
})

describe('formatKobo', () => {
  it('formats whole naira without decimals', () => {
    expect(formatKobo(35_000_000)).toMatch(/350,000$/)
    expect(formatKobo(35_000_000)).not.toContain('.')
  })
  it('keeps kobo when present', () => {
    expect(formatKobo(150_050)).toMatch(/1,500\.5$/)
  })
})
