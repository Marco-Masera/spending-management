import { describe, it, expect, vi, afterEach } from 'vitest'
import { createModel } from '@/data/model'

function monthId(month0: number, year: number) {
  const ym = year * 100 + (month0 + 1)
  return `month_${ym}`
}

describe('pouchdb-backed model', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('seeds settings and categories on first init', async () => {
    const m: any = createModel(`test-seed-${Date.now()}-${Math.random()}`)
    const first = await m.init({ platform: 'web' })

    expect(first).toBe(false)
    expect(m.get_default_value()).toBe('€')
    expect(m.get_budget()).toEqual({ type: 0, budget: 0 })
    expect(m.get_couchdb_url()).toBe('')
    expect(m.get_categories().length).toBeGreaterThan(0)

    await m.__test_destroy_db()
  })

  it('computes monthly totals from expense docs and uses month budget', async () => {
    const now = new Date(2026, 1, 10, 12, 0, 0).getTime() // Feb 10, 2026
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const m: any = createModel(`test-monthly-${Date.now()}-${Math.random()}`)
    await m.init({ platform: 'web' })
    await m.set_budget(0, 310) // monthly

    await m.add_expense(10, 'Grocery 🍴')
    await m.add_expense(5.5, 'Grocery 🍴')

    const exp = await m.get_monthly_expense()
    expect(exp.total_sum).toBe('15.50')

    // Feb 2026 has 28 days, daily = round2(310/28) = 11.07
    expect(exp.max_budget).toBe('309.96')
    expect(exp.budget_as_today).toBe('110.70')
    expect(exp.remains).toBe((110.7 - 15.5).toFixed(2))

    const all = await m.get_all_month_expenses()
    expect(all.length).toBe(2)
    expect((all[0] as any)._id).toMatch(/^exp_/) // internal id for delete
    expect(all[0].date).toBeInstanceOf(Date)

    // Delete one expense and recompute.
    const expectedRemaining = 15.5 - Number((all[0] as any).cost)
    await m.remove_expense(all[0])
    const exp2 = await m.get_monthly_expense()
    expect(Number(exp2.total_sum)).toBeCloseTo(expectedRemaining, 2)

    await m.__test_destroy_db()
  })

  it('get_past_monthly_expenses returns last N calendar months and creates missing months', async () => {
    const now = new Date(2026, 1, 10, 12, 0, 0).getTime() // Feb 2026
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const m: any = createModel(`test-past-${Date.now()}-${Math.random()}`)
    await m.init({ platform: 'web' })

    const months = await m.get_past_monthly_expenses(36)
    expect(months).toHaveLength(36)
    expect(months[0].month).toBe(1)
    expect(months[0].year).toBe(2026)

    // Oldest is 35 months before Feb 2026 => Mar 2023
    const last = months[35]
    expect(last.month).toBe(2)
    expect(last.year).toBe(2023)

    // Month docs should exist for both ends.
    const firstMonthDoc = await m.db.get(monthId(1, 2026))
    const lastMonthDoc = await m.db.get(monthId(2, 2023))
    expect(firstMonthDoc.type).toBe('month')
    expect(lastMonthDoc.type).toBe('month')

    // With no expenses, totals are 0.00.
    expect(months[10].total_sum).toBe('0.00')

    await m.__test_destroy_db()
  })

  it('starts and restarts sync when couchdbURL changes', async () => {
    const m: any = createModel(`test-sync-${Date.now()}-${Math.random()}`)
    await m.init({ platform: 'web' })

    const handler: any = {
      on: vi.fn(() => handler),
      cancel: vi.fn(),
    }
    m.db.sync = vi.fn(() => handler)

    await m.set_couchdb_url('https://user:pass@localhost:5984/spending')
    expect(m.db.sync).toHaveBeenCalledTimes(1)

    await m.set_couchdb_url('')
    expect(handler.cancel).toHaveBeenCalledTimes(1)

    await m.__test_destroy_db()
  })
})
