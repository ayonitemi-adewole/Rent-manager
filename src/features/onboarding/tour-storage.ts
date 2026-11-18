// Whether the guided setup is running, kept for the browser tab so a refresh mid-setup carries on.
const KEY = 'rentpadi.tour.active'

export function isTourActive(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setTourActive(on: boolean) {
  try {
    if (on) sessionStorage.setItem(KEY, '1')
    else sessionStorage.removeItem(KEY)
  } catch {
    // Private mode: the tour just won't survive a refresh.
  }
}
