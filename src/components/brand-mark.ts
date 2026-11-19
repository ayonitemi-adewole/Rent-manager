// The RentPadi mark: an open palm receiving a naira coin. One source of truth for the shapes,
// used by <LogoMark> in the app and by scripts/generate-brand-assets.ts for the icon files.
// Coordinates are in a 200×200 box (the app icon's artboard).

export const BRAND = {
  /** Padi Green: the brand colour. */
  green: '#0F5132',
  /** Naira Gold: the coin. */
  gold: '#F4B23E',
  goldRing: '#D8901C',
  /** Deep Green: the cuff, and text on cream. */
  deep: '#0A3A24',
  /** Mint: the cuff on green. */
  mint: '#8CC5A5',
  cream: '#F6F4EE',
  ink: '#10231A',
} as const

/** Less detail as the mark gets smaller, so it stays readable (≥64px · 32–63px · under 32px). */
export type MarkDetail = 'full' | 'medium' | 'small'

export function detailForSize(px: number): MarkDetail {
  if (px >= 64) return 'full'
  if (px >= 32) return 'medium'
  return 'small'
}

export const MARK = {
  /** Everything sits 12 units lower than drawn, to centre it in the box. */
  offsetY: 12,
  cuff: { x: 18, y: 114, width: 22, height: 48, rx: 6 },
  hand: 'M42 118 C54 112 64 100 72 90 C78 82 90 80 94 88 C97 95 92 106 90 114 C89 119 93 122 100 124 C116 128 134 127 148 121 C156 118 162 112 168 107 C175 102 184 107 181 117 C178 133 166 148 146 156 C120 166 80 166 56 160 C48 158 44 157 42 156 Z',
  /** Small sizes: hand and cuff in one shape. */
  handSimple:
    'M20 122 C40 116 60 104 72 90 C78 82 90 80 94 88 C97 95 92 106 90 114 C89 119 93 122 100 124 C116 128 134 127 148 121 C156 118 162 112 168 107 C175 102 184 107 181 117 C178 133 166 148 146 156 C120 166 60 166 20 162 Z',
  sparkle: 'M110 16 V24 M124 10 V20 M138 16 V24',
  coin: { cx: 124, cy: 62 },
  /** Coin radius by detail: bigger when there's less else to see. */
  coinR: { full: 30, medium: 30, small: 36 } satisfies Record<MarkDetail, number>,
  ringR: 23,
  /** The ₦, centred on the coin. Thicker strokes at medium size. */
  nairaN: 'M-8 11 V-11 L8 11 V-11',
  nairaBars: 'M-13 -3 H13 M-13 4 H13',
  nairaStroke: { full: [4, 3], medium: [5, 4] } as Record<Exclude<MarkDetail, 'small'>, [number, number]>,
  /** The bare mark's tight bounds (no empty margin), for lockups next to text. */
  cropViewBox: '14 18 172 160',
  /** App icon: tile corner radius and where the mark sits inside the tile. */
  tile: { rx: 45, inset: 21.4, scale: 0.786 },
} as const

export type MarkColors = {
  hand: string
  cuff: string
  coin: string
  ring: string
  naira: string
  sparkle: string
}

/** The mark as SVG markup (inner elements only, in the 200×200 box). */
export function markSvg(detail: MarkDetail, c: MarkColors): string {
  const m = MARK
  const parts: string[] = []
  if (detail === 'small') {
    parts.push(`<path d="${m.handSimple}" fill="${c.hand}"/>`)
  } else {
    const { x, y, width, height, rx } = m.cuff
    parts.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="${c.cuff}"/>`)
    parts.push(`<path d="${m.hand}" fill="${c.hand}"/>`)
  }
  if (detail === 'full') {
    parts.push(`<path d="${m.sparkle}" stroke="${c.sparkle}" stroke-width="4" stroke-linecap="round" fill="none"/>`)
  }
  parts.push(`<circle cx="${m.coin.cx}" cy="${m.coin.cy}" r="${m.coinR[detail]}" fill="${c.coin}"/>`)
  if (detail === 'full') {
    parts.push(
      `<circle cx="${m.coin.cx}" cy="${m.coin.cy}" r="${m.ringR}" fill="none" stroke="${c.ring}" stroke-width="2.5"/>`,
    )
  }
  if (detail !== 'small') {
    const [n, bars] = m.nairaStroke[detail]
    parts.push(
      `<g transform="translate(${m.coin.cx} ${m.coin.cy})" stroke="${c.naira}" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
        `<path d="${m.nairaN}" stroke-width="${n}"/><path d="${m.nairaBars}" stroke-width="${bars}"/></g>`,
    )
  }
  return `<g transform="translate(0 ${m.offsetY})">${parts.join('')}</g>`
}

/** Colours for the mark on Padi Green (app icon, "on green" lockup). */
export const ON_GREEN: MarkColors = {
  hand: '#FFFFFF',
  cuff: BRAND.mint,
  coin: BRAND.gold,
  ring: BRAND.goldRing,
  naira: BRAND.green,
  sparkle: BRAND.gold,
}

/** Colours for the mark on a light background. */
export const ON_LIGHT: MarkColors = {
  hand: BRAND.green,
  cuff: BRAND.deep,
  coin: BRAND.gold,
  ring: BRAND.goldRing,
  naira: BRAND.green,
  sparkle: BRAND.gold,
}

/** A complete app-icon SVG: the mark on a Padi Green tile (rounded, or square for iOS/maskable). */
export function appIconSvg({ rounded = true, detail = 'full' as MarkDetail, safeZone = 1 } = {}): string {
  const { rx, inset, scale } = MARK.tile
  // safeZone < 1 shrinks the mark towards the centre (Android maskable icons crop to a circle).
  const s = scale * safeZone
  const off = (200 - 200 * s) / 2
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">` +
    `<rect width="200" height="200" rx="${rounded ? rx : 0}" fill="${BRAND.green}"/>` +
    `<g transform="translate(${safeZone === 1 ? inset : off} ${safeZone === 1 ? inset : off}) scale(${s})">${markSvg(detail, ON_GREEN)}</g>` +
    `</svg>`
  )
}
