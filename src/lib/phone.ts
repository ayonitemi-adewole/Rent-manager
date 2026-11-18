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

/**
 * A WhatsApp number: any Nigerian format, or an international number starting with +
 * (e.g. "+44 7911 123456"). Returns E.164 or null.
 */
export function normalizeWhatsappPhone(input: string): string | null {
  const ng = normalizeNgPhone(input)
  if (ng) return ng
  const trimmed = input.trim()
  if (!trimmed.startsWith('+')) return null
  const digits = trimmed.replace(/[^\d]/g, '')
  return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null
}

/** Nigerian numbers as "0803 123 4567"; others as stored ("+447911123456"). */
export function formatPhone(e164: string): string {
  return /^\+234\d{10}$/.test(e164) ? formatNgPhone(e164) : e164
}
