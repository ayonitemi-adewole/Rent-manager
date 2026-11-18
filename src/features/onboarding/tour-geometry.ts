export type Box = { top: number; left: number; width: number; height: number }

export type CardPlacement = {
  top?: number
  bottom?: number
  left: number
  width: number
  /** Where the little pointer sits, if the card is attached to the target. */
  arrow?: { side: 'top' | 'bottom'; x: number }
}

const GUTTER = 16
const GAP = 14
const MAX_WIDTH = 360

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

/** The highlighted area: the target plus a little breathing room. */
export function holeFor(target: Box, pad = 6): Box {
  return { top: target.top - pad, left: target.left - pad, width: target.width + pad * 2, height: target.height + pad * 2 }
}

/**
 * Where the instruction card goes: below the hole if it fits, else above, else pinned to the
 * top of the screen (big targets like whole forms). No hole: bottom of the screen.
 */
export function placeCard(
  hole: Box | null,
  viewport: { width: number; height: number },
  cardHeight: number,
  pinned = false,
): CardPlacement {
  const width = Math.min(viewport.width - GUTTER * 2, MAX_WIDTH)
  const centred = (viewport.width - width) / 2
  if (!hole) return { bottom: GUTTER, left: centred, width }
  if (pinned) return { top: 12, left: centred, width }

  const centreX = hole.left + hole.width / 2
  const left = clamp(centreX - width / 2, GUTTER, viewport.width - width - GUTTER)
  const arrowX = clamp(centreX - left, 20, width - 20)
  const holeBottom = hole.top + hole.height

  if (viewport.height - holeBottom >= cardHeight + GAP + GUTTER) {
    return { top: holeBottom + GAP, left, width, arrow: { side: 'top', x: arrowX } }
  }
  if (hole.top >= cardHeight + GAP + GUTTER) {
    return { bottom: viewport.height - hole.top + GAP, left, width, arrow: { side: 'bottom', x: arrowX } }
  }
  return { top: 12, left: centred, width }
}
