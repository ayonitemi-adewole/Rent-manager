// Generates RentPadi's icon and image files from the mark in src/components/brand-mark.ts.
//
//   node scripts/generate-brand-assets.ts
//
// SVGs are written directly; PNGs are rendered with headless Edge or Chrome (set BROWSER to its
// path if it isn't found). Re-run after changing the mark or the brand colours.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { appIconSvg, BRAND, MARK, markSvg, ON_LIGHT } from '../src/components/brand-mark.ts'

const root = resolve(import.meta.dirname, '..')
const out = (path: string) => {
  const full = join(root, path)
  mkdirSync(dirname(full), { recursive: true })
  return full
}

const BROWSERS = [
  process.env.BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter((p): p is string => Boolean(p))

const browser = BROWSERS.find((p) => existsSync(p))
const scratch = mkdtempSync(join(tmpdir(), 'rentpadi-brand-'))

const FONT_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;800&display=block">'

/** Render an HTML body at an exact size to a PNG. */
function png(path: string, width: number, height: number, body: string, transparent = false) {
  if (!browser) throw new Error('No Edge/Chrome found: set BROWSER to its path')
  const html = join(scratch, `${width}x${height}-${Math.random().toString(36).slice(2)}.html`)
  writeFileSync(
    html,
    `<!doctype html><html><head><meta charset="utf-8">${FONT_LINK}<style>html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden;background:transparent}svg{display:block}</style></head><body>${body}</body></html>`,
  )
  execFileSync(
    browser,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      `--window-size=${width},${height}`,
      '--virtual-time-budget=8000',
      ...(transparent ? ['--default-background-color=00000000'] : []),
      `--screenshot=${out(path)}`,
      pathToFileURL(html).href,
    ],
    { stdio: 'ignore' },
  )
  console.log(`  ${path}`)
}

const svgAt = (svg: string, size: number) => svg.replace('<svg ', `<svg width="${size}" height="${size}" `)

/** The full logo (mark + "Rent Padi") as HTML, for the PNG renders. */
function lockup({ markPx, textPx, onGreen = false }: { markPx: number; textPx: number; onGreen?: boolean }) {
  const colors = onGreen
    ? {
        hand: '#FFFFFF',
        cuff: BRAND.mint,
        coin: BRAND.gold,
        ring: BRAND.goldRing,
        naira: BRAND.green,
        sparkle: BRAND.gold,
      }
    : ON_LIGHT
  const h = Math.round((markPx * 160) / 172)
  return (
    `<div style="display:flex;align-items:center;gap:${Math.round(textPx * 0.28)}px">` +
    `<svg width="${markPx}" height="${h}" viewBox="${MARK.cropViewBox}">${markSvg('full', colors)}</svg>` +
    `<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:${textPx}px;letter-spacing:-0.025em;line-height:1;color:${onGreen ? '#fff' : BRAND.green};white-space:nowrap">` +
    `<span style="font-weight:500">Rent</span> <span style="font-weight:800">Padi</span></div></div>`
  )
}

console.log('SVG')
// Browser tab: the simplified mark on a rounded tile (the full one turns to mush at 16px).
writeFileSync(out('public/favicon.svg'), appIconSvg({ detail: 'small' }) + '\n')
// Loading screen (56px): a little more detail.
writeFileSync(out('public/icon.svg'), appIconSvg({ detail: 'medium' }) + '\n')
console.log('  public/favicon.svg, public/icon.svg')
writeFileSync(out('docs/brand/app-icon.svg'), appIconSvg() + '\n')
writeFileSync(
  out('docs/brand/mark.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK.cropViewBox}">${markSvg('full', ON_LIGHT)}</svg>\n`,
)
console.log('  docs/brand/app-icon.svg, docs/brand/mark.svg')

if (!browser) {
  console.warn('\nNo Edge/Chrome found: PNGs skipped. Set BROWSER to its path and run again.')
  process.exit(0)
}

console.log('PNG')
// iOS home screen: square (iOS rounds the corners itself), no transparency.
png('public/apple-touch-icon.png', 180, 180, svgAt(appIconSvg({ rounded: false }), 180))
// Android / install: rounded tile ("any"), plus a full-bleed one Android can crop to its own shape.
png('public/icon-192.png', 192, 192, svgAt(appIconSvg(), 192), true)
png('public/icon-512.png', 512, 512, svgAt(appIconSvg(), 512), true)
png('public/icon-maskable-512.png', 512, 512, svgAt(appIconSvg({ rounded: false, safeZone: 0.8 }), 512))

// Link previews (WhatsApp, SMS apps, social): 1200×630, logo centred so a square crop keeps the mark.
png(
  'public/og-image.png',
  1200,
  630,
  `<div style="width:1200px;height:630px;box-sizing:border-box;background:${BRAND.cream};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:36px;font-family:'Plus Jakarta Sans',sans-serif">` +
    lockup({ markPx: 200, textPx: 116 }) +
    `<div style="font-size:34px;font-weight:600;color:${BRAND.deep};letter-spacing:-0.01em">Rent reminders, payments and receipts</div></div>`,
)

// WhatsApp Business profile photo: WhatsApp crops it to a circle, so the mark stays well inside.
png('docs/brand/whatsapp-profile.png', 640, 640, svgAt(appIconSvg({ rounded: false, safeZone: 0.78 }), 640))

// Logo files for documents, printing and partners.
png(
  'docs/brand/logo.png',
  1200,
  360,
  `<div style="width:1200px;height:360px;display:flex;align-items:center;justify-content:center">${lockup({ markPx: 220, textPx: 128 })}</div>`,
  true,
)
png(
  'docs/brand/logo-on-green.png',
  1200,
  360,
  `<div style="width:1200px;height:360px;background:${BRAND.green};display:flex;align-items:center;justify-content:center">${lockup({ markPx: 220, textPx: 128, onGreen: true })}</div>`,
)
console.log('\nDone.')
