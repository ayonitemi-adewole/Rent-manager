// Light / dark / follow the device. The choice is per device (a landlord may want dark on their
// phone and light on a shared office computer), so it's kept in this browser, not the account.
//
// index.html applies the saved choice before the first paint (no flash); keep its inline script
// in step with STORAGE_KEY and resolveDark().

import { useSyncExternalStore } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'

export const STORAGE_KEY = 'rentpadi-theme'
const CHANGE_EVENT = 'rentpadi-theme-change'

export function parseThemePref(value: string | null | undefined): ThemePref {
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function resolveDark(pref: ThemePref, systemDark: boolean): boolean {
  return pref === 'dark' || (pref === 'system' && systemDark)
}

/** Used when the browser blocks storage: the choice then lasts for this visit only. */
let unsaved: ThemePref = 'system'

export function readThemePref(): ThemePref {
  try {
    return parseThemePref(localStorage.getItem(STORAGE_KEY))
  } catch {
    return unsaved
  }
}

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)')

function apply() {
  document.documentElement.classList.toggle('dark', resolveDark(readThemePref(), systemDark().matches))
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    unsaved = pref // can't remember it; still switch for this visit
  }
  apply()
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
}

/** Call once at start-up: applies the choice and follows the device / other tabs. */
export function initTheme() {
  apply()
  systemDark().addEventListener('change', apply) // only changes anything while on "device"
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      apply()
      window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
    }
  })
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => window.removeEventListener(CHANGE_EVENT, onChange)
}

/** The saved choice, kept in sync across the app (and other tabs). */
export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, readThemePref, () => 'system')
}
