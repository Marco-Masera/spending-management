import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('@capacitor/filesystem', () => {
  const Filesystem = {
    mkdir: vi.fn(async () => undefined),
    stat: vi.fn(async () => ({ size: 0 })),
    writeFile: vi.fn(async () => ({ uri: 'file://app.log' })),
    appendFile: vi.fn(async () => undefined),
    deleteFile: vi.fn(async () => undefined),
    rename: vi.fn(async () => undefined),
    getUri: vi.fn(async () => ({ uri: 'file://app.log' })),
  }

  return {
    Filesystem,
    Directory: { Data: 'DATA' },
    Encoding: { UTF8: 'utf8' },
  }
})

import { initLogger, logger, redactSecrets, shutdownLogger } from '@/lib/logger'
import { Filesystem } from '@capacitor/filesystem'

describe('logger', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    shutdownLogger()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('redacts scheme://user:pass@ URLs', () => {
    expect(redactSecrets('https://user:pass@localhost:5984/db')).toBe(
      'https://<redacted>@localhost:5984/db',
    )
    expect(redactSecrets('no secrets here')).toBe('no secrets here')
    expect(redactSecrets('http://a:b@h x https://u:p@h2/y')).toBe(
      'http://<redacted>@h x https://<redacted>@h2/y',
    )
  })

  it('buffers and flushes to appendFile on Android', async () => {
    ;(Filesystem.appendFile as any).mockClear()
    await initLogger({ platform: 'android' })

    logger.info('[t] one')
    logger.info('[t] two', { url: 'https://u:p@host/db' })
    expect(Filesystem.appendFile).toHaveBeenCalledTimes(0)

    await vi.advanceTimersByTimeAsync(1600)
    for (let i = 0; i < 5; i++) await Promise.resolve()
    expect(Filesystem.appendFile).toHaveBeenCalledTimes(1)

    const call = (Filesystem.appendFile as any).mock.calls[0][0]
    expect(call.path).toBe('logs/app.log')
    expect(String(call.data)).toContain('[t] one')
    expect(String(call.data)).toContain('https://<redacted>@host/db')
  })

  it('flushes early when queue reaches max lines', async () => {
    ;(Filesystem.appendFile as any).mockClear()
    await initLogger({ platform: 'android' })

    for (let i = 0; i < 55; i++) {
      logger.info(`[t] ${i}`)
    }

    // Flush is async; let microtasks run.
    for (let i = 0; i < 10; i++) await Promise.resolve()
    expect((Filesystem.appendFile as any).mock.calls.length).toBeGreaterThan(0)
  })
})
