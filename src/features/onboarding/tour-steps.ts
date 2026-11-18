// The guided setup: four tasks, each pointing at the right button for the page you're on.
// Elements opt in with data-tour="<target>"; the overlay dims everything else.

export type SetupProgress = { properties: number; units: number; tenants: number; payout: boolean }

export type TourTarget =
  | 'nav-properties'
  | 'nav-tenants'
  | 'nav-settings'
  | 'add-property'
  | 'property-form'
  | 'property-card'
  | 'add-unit'
  | 'unit-form'
  | 'add-tenant'
  | 'tenant-form'
  | 'payout-link'
  | 'payout-form'

export type TourStep = {
  target: TourTarget
  title: string
  body: string
  /** Big targets (whole forms) get a compact card pinned to the top instead of an arrow. */
  pinned?: boolean
}

type Guide = { when: (path: string) => boolean; step: TourStep }

export type SetupTask = {
  id: 'property' | 'unit' | 'tenant' | 'payout'
  label: string
  done: (p: SetupProgress) => boolean
  guides: Guide[]
}

const on = (re: RegExp) => (path: string) => re.test(path)
const anywhere = () => true
const PROPERTY_DETAIL = /^\/properties\/(?!new$)[^/]+$/

export const SETUP_TASKS: SetupTask[] = [
  {
    id: 'property',
    label: 'Add your first property',
    done: (p) => p.properties > 0,
    guides: [
      {
        when: on(/^\/properties\/new$/),
        step: {
          target: 'property-form',
          title: 'Describe the building',
          body: 'Give it a name you’ll recognise, like “Ring Road shops”, add the address, then tap Save.',
          pinned: true,
        },
      },
      {
        when: on(/^\/properties$/),
        step: {
          target: 'add-property',
          title: 'Add a property',
          body: 'A property is a building or compound. Tap here to add one.',
        },
      },
      {
        when: anywhere,
        step: { target: 'nav-properties', title: 'Start with your buildings', body: 'Tap Properties.' },
      },
    ],
  },
  {
    id: 'unit',
    label: 'Add the flats, shops or rooms',
    done: (p) => p.units > 0,
    guides: [
      {
        when: on(/^\/properties\/[^/]+\/units\/new$/),
        step: {
          target: 'unit-form',
          title: 'Describe the unit',
          body: 'Name it (e.g. “Flat 2” or “Shop 1”), set the rent and how often it’s paid, then Save.',
          pinned: true,
        },
      },
      {
        when: on(PROPERTY_DETAIL),
        step: {
          target: 'add-unit',
          title: 'Add a unit',
          body: 'Each flat, shop or room you rent out is a unit. Tap here to add the first one.',
        },
      },
      {
        when: on(/^\/properties$/),
        step: { target: 'property-card', title: 'Open your property', body: 'Tap it to add its units.' },
      },
      {
        when: anywhere,
        step: { target: 'nav-properties', title: 'Now add units', body: 'Tap Properties.' },
      },
    ],
  },
  {
    id: 'tenant',
    label: 'Add a tenant',
    done: (p) => p.tenants > 0,
    guides: [
      {
        when: on(/^\/tenants\/new$/),
        step: {
          target: 'tenant-form',
          title: 'Add your tenant',
          body: 'Their name and phone number, the unit, and when rent is next due. Reminders start from there.',
          pinned: true,
        },
      },
      {
        when: on(/^\/tenants$/),
        step: { target: 'add-tenant', title: 'Add a tenant', body: 'Tap here to add who rents the unit.' },
      },
      {
        when: anywhere,
        step: { target: 'nav-tenants', title: 'Who rents it?', body: 'Tap Tenants to add your first tenant.' },
      },
    ],
  },
  {
    id: 'payout',
    label: 'Set up your payout account',
    done: (p) => p.payout,
    guides: [
      {
        when: on(/^\/settings\/payout$/),
        step: {
          target: 'payout-form',
          title: 'Where should rent go?',
          body: 'Choose your bank and enter your account number. Online payments go straight there.',
          pinned: true,
        },
      },
      {
        when: on(/^\/settings$/),
        step: {
          target: 'payout-link',
          title: 'Get paid online',
          body: 'Tap here to add the bank account tenants’ rent is paid into.',
        },
      },
      {
        when: anywhere,
        step: { target: 'nav-settings', title: 'Last step: get paid online', body: 'Tap Settings.' },
      },
    ],
  },
]

export type TourPosition =
  | { kind: 'step'; taskIndex: number; total: number; task: SetupTask; step: TourStep }
  | { kind: 'finished' }

/** Where the tour is: the first unfinished task, and the step for the current page. */
export function tourPosition(progress: SetupProgress, path: string): TourPosition {
  const taskIndex = SETUP_TASKS.findIndex((t) => !t.done(progress))
  if (taskIndex === -1) return { kind: 'finished' }
  const task = SETUP_TASKS[taskIndex]
  const step = task.guides.find((g) => g.when(path))!.step // every task ends with an `anywhere` guide
  return { kind: 'step', taskIndex, total: SETUP_TASKS.length, task, step }
}

export function doneCount(progress: SetupProgress): number {
  return SETUP_TASKS.filter((t) => t.done(progress)).length
}
