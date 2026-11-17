import { describe, expect, it } from 'vitest'
import { formatNgPhone, normalizeNgPhone } from './phone'

describe('normalizeNgPhone', () => {
  it.each([
    ['08031234567', '+2348031234567'],
    ['0803 123 4567', '+2348031234567'],
    ['2348031234567', '+2348031234567'],
    ['+234 803 123 4567', '+2348031234567'],
    ['8031234567', '+2348031234567'],
    ['07061234567', '+2347061234567'],
    ['09151234567', '+2349151234567'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeNgPhone(input)).toBe(expected)
  })

  it.each(['', '0803123456', '080312345678', '06031234567', '08231234567', 'hello'])(
    'rejects %s',
    (input) => {
      expect(normalizeNgPhone(input)).toBeNull()
    },
  )
})

describe('formatNgPhone', () => {
  it('formats E.164 for display', () => {
    expect(formatNgPhone('+2348031234567')).toBe('0803 123 4567')
  })
})
