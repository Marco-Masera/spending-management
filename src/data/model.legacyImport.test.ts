import { describe, it, expect } from 'vitest'

import { legacyToDocs, BudgetType } from '@/data/model'
import { DEFAULT_CATEGORIES } from '@/data/modelDefaults'

function monthId(month0: number, year: number) {
  const ym = year * 100 + (month0 + 1)
  return `month_${ym}`
}

describe('legacy import conversion', () => {
  it('uses last valid month bucket for settings budget and imports only seen categories', () => {
    const legacy: any = {
      '0_2024': {
        daily_budget: 10,
        month: 0,
        year: 2024,
        spending: [
          {
            category: 'Home',
            cost: '1.20',
            date: '2024-01-02T00:00:00.000Z',
          },
        ],
      },
      '1_2024': {
        daily_budget: 20,
        month: 1,
        year: 2024,
        spending: [
          {
            category: 'Dining',
            cost: '2.50',
            date: '2024-02-03T00:00:00.000Z',
          },
        ],
      },
      settings: {
        daily_budget: 999,
        month: 0,
        year: 1970,
        spending: [],
      },
    }

    const docs = legacyToDocs(legacy)
    expect(docs.length).toBeGreaterThan(0)

    const settings: any = docs.find((d: any) => d && d._id === 'settings')
    expect(settings).toBeTruthy()
    expect(settings.budget).toEqual({ type: BudgetType.Daily, budget: 20 })

    const m1: any = docs.find((d: any) => d && d._id === monthId(0, 2024))
    const m2: any = docs.find((d: any) => d && d._id === monthId(1, 2024))
    expect(m1?.type).toBe('month')
    expect(m1?.budget).toEqual({ type: BudgetType.Daily, budget: 10 })
    expect(m2?.type).toBe('month')
    expect(m2?.budget).toEqual({ type: BudgetType.Daily, budget: 20 })

    const cats = docs
      .filter((d: any) => d && d.type === 'category')
      .map((d: any) => d.name)
      .sort()
    expect(cats).toEqual(['Dining', 'Home'])

    const exps = docs.filter((d: any) => d && d.type === 'expense')
    expect(exps).toHaveLength(2)
    for (const e of exps as any[]) {
      expect(typeof e.ts).toBe('number')
      expect(typeof e.cost).toBe('number')
      expect(typeof e.category).toBe('string')
    }
  })

  it('falls back to default categories when legacy has none', () => {
    const legacy: any = {
      '0_2025': {
        daily_budget: 12.5,
        month: 0,
        year: 2025,
        spending: [],
      },
    }

    const docs = legacyToDocs(legacy)
    const cats = docs
      .filter((d: any) => d && d.type === 'category')
      .map((d: any) => d.name)

    expect(cats).toHaveLength(DEFAULT_CATEGORIES.length)
    expect(cats).toContain(DEFAULT_CATEGORIES[0])
  })
})
