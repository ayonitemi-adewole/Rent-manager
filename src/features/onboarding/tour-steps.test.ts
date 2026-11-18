import { describe, expect, it } from 'vitest'
import { doneCount, tourPosition, type SetupProgress } from './tour-steps'

const none: SetupProgress = { properties: 0, units: 0, tenants: 0, payout: false }
const target = (p: SetupProgress, path: string) => {
  const pos = tourPosition(p, path)
  return pos.kind === 'step' ? `${pos.task.id}:${pos.step.target}` : 'finished'
}

describe('tourPosition', () => {
  it('walks a new landlord to Add property', () => {
    expect(target(none, '/')).toBe('property:nav-properties')
    expect(target(none, '/properties')).toBe('property:add-property')
    expect(target(none, '/properties/new')).toBe('property:property-form')
  })

  it('then to the property, Add unit and the unit form', () => {
    const p = { ...none, properties: 1 }
    expect(target(p, '/tenants')).toBe('unit:nav-properties')
    expect(target(p, '/properties')).toBe('unit:property-card')
    expect(target(p, '/properties/abc')).toBe('unit:add-unit')
    expect(target(p, '/properties/abc/units/new')).toBe('unit:unit-form')
    expect(target(p, '/properties/abc/edit')).toBe('unit:nav-properties')
  })

  it('then tenants, then payout', () => {
    const p = { ...none, properties: 1, units: 2 }
    expect(target(p, '/properties/abc')).toBe('tenant:nav-tenants')
    expect(target(p, '/tenants')).toBe('tenant:add-tenant')
    expect(target(p, '/tenants/new')).toBe('tenant:tenant-form')
    const q = { ...p, tenants: 1 }
    expect(target(q, '/')).toBe('payout:nav-settings')
    expect(target(q, '/settings')).toBe('payout:payout-link')
    expect(target(q, '/settings/payout')).toBe('payout:payout-form')
  })

  it('skips tasks already done, in any order', () => {
    expect(target({ ...none, payout: true }, '/')).toBe('property:nav-properties')
    expect(target({ properties: 1, units: 1, tenants: 1, payout: true }, '/')).toBe('finished')
  })

  it('reports step numbers', () => {
    const pos = tourPosition({ ...none, properties: 1 }, '/')
    expect(pos.kind === 'step' && [pos.taskIndex + 1, pos.total]).toEqual([2, 4])
  })
})

describe('doneCount', () => {
  it('counts finished tasks', () => {
    expect(doneCount(none)).toBe(0)
    expect(doneCount({ properties: 2, units: 0, tenants: 0, payout: true })).toBe(2)
  })
})
