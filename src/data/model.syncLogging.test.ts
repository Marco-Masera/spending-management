import { describe, it, expect, vi, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: mocks,
}))

import { createModel } from '@/data/model'

describe('model sync logging', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    mocks.info.mockClear()
    mocks.warn.mockClear()
    mocks.error.mockClear()
  })

  it('logs sync start and stop when couchdbURL changes', async () => {
    const m: any = createModel(`test-sync-logging-${Date.now()}-${Math.random()}`)
    await m.init({ platform: 'web' })

    const handler: any = {
      on: vi.fn(() => handler),
      cancel: vi.fn(),
    }
    m.db.sync = vi.fn(() => handler)

    await m.set_couchdb_url('https://user:pass@localhost:5984/spending')
    expect(mocks.info.mock.calls.some((c) => String(c[0]).includes('[sync] start'))).toBe(true)

    await m.set_couchdb_url('')
    expect(mocks.info.mock.calls.some((c) => String(c[0]).includes('[sync] stop'))).toBe(true)

    await m.__test_destroy_db()
  })
})
