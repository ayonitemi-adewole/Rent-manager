// Hand a file to the phone's share sheet (WhatsApp, Telegram, email…), or download it where
// sharing files isn't supported (most desktop browsers).

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

/** Thrown when the browser says the tap was too long ago (we fetched data first); tap again to share. */
export class NeedsAnotherTap extends Error {}

export function canShareFiles(file: File): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function shareOrDownload(file: File, text: string): Promise<ShareResult> {
  if (!canShareFiles(file)) {
    downloadFile(file)
    return 'downloaded'
  }
  try {
    await navigator.share({ files: [file], text })
    return 'shared'
  } catch (err) {
    const name = (err as { name?: string }).name
    if (name === 'AbortError') return 'cancelled'
    if (name === 'NotAllowedError') throw new NeedsAnotherTap()
    throw err
  }
}
