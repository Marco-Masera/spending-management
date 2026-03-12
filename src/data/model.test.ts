import { describe, it, expect, vi, afterEach } from 'vitest'
import { createModel } from '@/data/model'
import { DEFAULT_CATEGORIES } from '@/data/modelDefaults'

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
    expect(m.get_sync_status()).toEqual({ state: 'not_configured', error: '' })
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

  it('includes monthly recurring expenses in monthly totals and category totals', async () => {
    const now = new Date(2026, 1, 10, 12, 0, 0).getTime() // Feb 10, 2026
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const m: any = createModel(`test-recurring-monthly-${Date.now()}-${Math.random()}`)
    await m.init({ platform: 'web' })

    const created = await m.add_recurring_expense({
      amount: 12.5,
      category: 'Subscriptions 🖥',
      frequency: 'monthly',
      startDate: new Date(2026, 0, 5, 9, 30, 0),
    })

    expect(created).toBe(true)

    await m.add_expense(2.5, 'Subscriptions 🖥')

    const all = await m.get_all_month_expenses(1, 2026)
    expect(all).toHaveLength(2)
    expect((all[0] as any)._id).toMatch(/^recur_occ_/)
    expect(all[0].date.getDate()).toBe(5)

    const monthly = await m.get_monthly_expense(1, 2026)
    expect(monthly.total_sum).toBe('15.00')

    const categories = await m.get_expenses_by_category(1, 2026)
    expect(categories).toEqual([['Subscriptions 🖥', '15.00']])

    await m.__test_destroy_db()
  })

  it('supports deleting a generated recurring occurrence and respects the recurring end date', async () => {
    const m: any = createModel(`test-recurring-skip-${Date.now()}-${Math.random()}`)
    await m.init({ platform: 'web' })

    const created = await m.add_recurring_expense({
      amount: 30,
      category: 'Bills 📄',
      frequency: 'monthly',
      startDate: new Date(2026, 0, 15, 8, 0, 0),
      endDate: new Date(2026, 2, 15),
    })

    expect(created).toBe(true)

    const january = await m.get_all_month_expenses(0, 2026)
    expect(january).toHaveLength(1)
    expect((january[0] as any)._id).toMatch(/^recur_occ_/)

    await m.remove_expense(january[0])

    const januaryAfterDelete = await m.get_all_month_expenses(0, 2026)
    expect(januaryAfterDelete).toHaveLength(0)

    const february = await m.get_all_month_expenses(1, 2026)
    expect(february).toHaveLength(1)
    expect(february[0].cost).toBe('30.00')

    const march = await m.get_all_month_expenses(2, 2026)
    expect(march).toHaveLength(1)

    const april = await m.get_all_month_expenses(3, 2026)
    expect(april).toHaveLength(0)

    await m.__test_destroy_db()
  })

  it('lists recurring expenses with active filtering and default ordering', async () => {
    const now = new Date(2025, 0, 15, 12, 0, 0).getTime()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const m: any = createModel(`test-recurring-list-${Date.now()}-${Math.random()}`)
    await m.init({ platform: 'web' })

    await m.add_recurring_expense({
      amount: 10,
      category: 'Recurring A',
      frequency: 'monthly',
      startDate: new Date(2025, 0, 1, 9, 0, 0),
    })
    await m.add_recurring_expense({
      amount: 20,
      category: 'Recurring B',
      frequency: 'monthly',
      startDate: new Date(2024, 11, 1, 9, 0, 0),
    })
    await m.add_recurring_expense({
      amount: 30,
      category: 'Recurring C',
      frequency: 'monthly',
      startDate: new Date(2025, 0, 1, 9, 0, 0),
      endDate: new Date(2025, 1, 1),
    })
    await m.add_recurring_expense({
      amount: 40,
      category: 'Recurring Future',
      frequency: 'monthly',
      startDate: new Date(2025, 1, 1, 9, 0, 0),
    })
    await m.add_recurring_expense({
      amount: 50,
      category: 'Recurring Ended',
      frequency: 'monthly',
      startDate: new Date(2024, 10, 1, 9, 0, 0),
      endDate: new Date(2025, 0, 10),
    })

    const all = await m.list_all_recurring_expenses()
    expect(all.map((item: any) => item.category)).toEqual([
      'Recurring Future',
      'Recurring A',
      'Recurring B',
      'Recurring Ended',
      'Recurring C',
    ])

    const active = await m.list_recurring_expenses({
      start: new Date(now),
      end: new Date(now),
    })
    expect(active.map((item: any) => item.category)).toEqual([
      'Recurring A',
      'Recurring B',
      'Recurring C',
    ])

    await m.__test_destroy_db()
  })

  it('supports yearly recurring expenses out of the box', async () => {
    const m: any = createModel(`test-recurring-yearly-${Date.now()}-${Math.random()}`)
    await m.init({ platform: 'web' })

    const created = await m.add_recurring_expense({
      amount: 250,
      category: 'Travel 🚞',
      frequency: 'yearly',
      startDate: new Date(2024, 6, 4, 7, 45, 0),
      endDate: new Date(2027, 6, 4),
    })

    expect(created).toBe(true)

    const july2026 = await m.get_all_month_expenses(6, 2026)
    expect(july2026).toHaveLength(1)
    expect(july2026[0].cost).toBe('250.00')
    expect(july2026[0].date.getFullYear()).toBe(2026)
    expect(july2026[0].date.getMonth()).toBe(6)
    expect(july2026[0].date.getDate()).toBe(4)

    const june2026 = await m.get_all_month_expenses(5, 2026)
    expect(june2026).toHaveLength(0)

    const july2028 = await m.get_all_month_expenses(6, 2028)
    expect(july2028).toHaveLength(0)

    await m.__test_destroy_db()
  })

  it('updates and clears an existing recurring expense end date', async () => {
    const m: any = createModel(`test-recurring-update-end-${Date.now()}-${Math.random()}`)
    await m.init({ platform: 'web' })

    const created = await m.add_recurring_expense({
      amount: 18,
      category: 'Membership',
      frequency: 'monthly',
      startDate: new Date(2026, 0, 5, 9, 30, 0),
    })

    expect(created).toBe(true)

    const recurring = await m.list_all_recurring_expenses()
    expect(recurring).toHaveLength(1)

    const updated = await m.update_recurring_expense_end_date(
      recurring[0]._id,
      new Date(2026, 1, 5),
    )
    expect(updated).toBe(true)

    const february = await m.get_all_month_expenses(1, 2026)
    expect(february).toHaveLength(1)

    const march = await m.get_all_month_expenses(2, 2026)
    expect(march).toHaveLength(0)

    const afterUpdate = await m.list_all_recurring_expenses()
    expect(afterUpdate[0].endDate).toBeInstanceOf(Date)
    expect(afterUpdate[0].endDate?.getMonth()).toBe(1)

    const cleared = await m.update_recurring_expense_end_date(recurring[0]._id, null)
    expect(cleared).toBe(true)

    const april = await m.get_all_month_expenses(3, 2026)
    expect(april).toHaveLength(1)

    const afterClear = await m.list_all_recurring_expenses()
    expect(afterClear[0].endDate).toBeNull()

    await m.__test_destroy_db()
  })

  it('deletes a recurring expense and cleans up its skip tombstones', async () => {
    const m: any = createModel(`test-recurring-delete-${Date.now()}-${Math.random()}`)
    await m.init({ platform: 'web' })

    const created = await m.add_recurring_expense({
      amount: 45,
      category: 'Insurance',
      frequency: 'monthly',
      startDate: new Date(2026, 0, 20, 10, 0, 0),
      endDate: new Date(2026, 5, 20),
    })

    expect(created).toBe(true)

    const recurringDocs = await m.getRecurringExpenseDocs()
    expect(recurringDocs).toHaveLength(1)
    const recurringId = recurringDocs[0]._id

    const january = await m.get_all_month_expenses(0, 2026)
    expect(january).toHaveLength(1)

    await m.remove_expense(january[0])

    const skipsBeforeDelete = await m.getRecurringSkipDocs(recurringId)
    expect(skipsBeforeDelete).toHaveLength(1)

    const removed = await m.remove_recurring_expense(recurringId)
    expect(removed).toBe(true)

    const recurringAfterDelete = await m.getRecurringExpenseDocs()
    expect(recurringAfterDelete).toHaveLength(0)

    const skipsAfterDelete = await m.getRecurringSkipDocs(recurringId)
    expect(skipsAfterDelete).toHaveLength(0)

    const januaryAfterDelete = await m.get_all_month_expenses(0, 2026)
    expect(januaryAfterDelete).toHaveLength(0)

    const februaryAfterDelete = await m.get_all_month_expenses(1, 2026)
    expect(februaryAfterDelete).toHaveLength(0)

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

    m._probeSyncTarget = vi.fn(async (url: string) => {
      if (url.includes('offline')) {
        m._setSyncStatus('error', 'Could not connect to CouchDB.')
        return
      }
      m._setSyncStatus('ok')
    })

    const callbacks: Record<string, (payload?: any) => void> = {}
    const handler: any = {
      on: vi.fn((event: string, cb: (payload?: any) => void) => {
        callbacks[event] = cb
        return handler
      }),
      cancel: vi.fn(),
    }
    m.db.sync = vi.fn(() => handler)

    await m.set_couchdb_url('https://user:pass@localhost:5984/spending')
    expect(m.db.sync).toHaveBeenCalledTimes(1)
    expect(m._probeSyncTarget).toHaveBeenCalledWith(
      'https://user:pass@localhost:5984/spending',
      expect.any(Number),
    )
    expect(m.get_sync_status()).toEqual({ state: 'ok', error: '' })

    callbacks.active?.()
    expect(m.get_sync_status()).toEqual({ state: 'ok', error: '' })

    callbacks.error?.({ message: 'bad gateway' })
    expect(m.get_sync_status()).toEqual({ state: 'error', error: 'bad gateway' })

    callbacks.active?.()
    expect(m.get_sync_status()).toEqual({ state: 'connecting', error: '' })

    callbacks.change?.()
    expect(m.get_sync_status()).toEqual({ state: 'ok', error: '' })

    await m.set_couchdb_url('https://user:pass@offline:5984/spending')
    expect(m.get_sync_status()).toEqual({ state: 'error', error: 'Could not connect to CouchDB.' })

    await m.set_couchdb_url('')
    expect(handler.cancel).toHaveBeenCalledTimes(1)
    expect(m.get_sync_status()).toEqual({ state: 'not_configured', error: '' })

    await m.__test_destroy_db()
  })

  it('clears local data and reseeds defaults', async () => {
    const now = new Date(2026, 1, 10, 12, 0, 0).getTime()
    vi.spyOn(Date, 'now').mockReturnValue(now)

    const m: any = createModel(`test-clear-${Date.now()}-${Math.random()}`)
    m._restartSync = vi.fn(async () => {})
    await m.init({ platform: 'web' })

    m.set_default_value('$')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await m.set_budget(0, 123)
    expect(m.get_default_value()).toBe('$')
    expect(m.get_budget()).toEqual({ type: 0, budget: 123 })

    m.add_category('Custom')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(m.get_categories()).toContain('Custom')
    await m.add_expense(10, 'Custom')
    const before = await m.get_all_month_expenses()
    expect(before.length).toBe(1)

    await m.clear_data()

    expect(m.get_default_value()).toBe('€')
    expect(m.get_budget()).toEqual({ type: 0, budget: 0 })
    expect(m.get_categories()).toEqual(DEFAULT_CATEGORIES)
    const after = await m.get_all_month_expenses()
    expect(after.length).toBe(0)

    await m.__test_destroy_db()
  })
})
