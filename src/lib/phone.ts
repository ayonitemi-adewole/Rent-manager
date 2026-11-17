// Nigerian mobile numbers: 234 + 10 digits, first digit 7/8/9 (e.g. 0803…, 0706…, 0915…).

/** Normalise user input to E.164 ("+2348031234567"). Returns null if not a valid NG mobile. */
export function normalizeNgPhone(input: string): string | null {
  let digits = input.replace(/[^\d]/g, '')
  if (digits.startsWith('234')) digits = digits.slice(3)
  else if (digits.startsWith('0')) digits = digits.slice(1)
  if (!/^[789][01]\d{8}$/.test(digits)) return null
  return `+234${digits}`
}

/** "+2348031234567" → "0803 123 4567" for display. */
export function formatNgPhone(e164: string): string {
  const local = '0' + e164.replace(/^\+?234/, '')
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
}
