import { Filesystem, Directory, Encoding } from '@capacitor/filesystem'

export const LOG_FILE_DIRECTORY = Directory.Data
export const LOG_FILE_PATH = 'logs/app.log'
const LOG_DIR = 'logs'
const ROTATED_LOG_FILE_PATH = 'logs/app.log.1'

const DEFAULT_FLUSH_INTERVAL_MS = 1500
const DEFAULT_MAX_QUEUE_LINES = 50
const DEFAULT_MAX_BYTES = 1024 * 1024

type Level = 'INFO' | 'WARN' | 'ERROR'

type LoggerState = {
  platform: string
  fileEnabled: boolean
  initialized: boolean
  flushIntervalMs: number
  maxQueueLines: number
  maxBytes: number
  queue: string[]
  timer: ReturnType<typeof setTimeout> | undefined
  flushing: boolean
  windowListenersInstalled: boolean
  _onWindowError: ((ev: Event) => void) | undefined
  _onUnhandledRejection: ((ev: Event) => void) | undefined
}

const state: LoggerState = {
  platform: 'web',
  fileEnabled: false,
  initialized: false,
  flushIntervalMs: DEFAULT_FLUSH_INTERVAL_MS,
  maxQueueLines: DEFAULT_MAX_QUEUE_LINES,
  maxBytes: DEFAULT_MAX_BYTES,
  queue: [],
  timer: undefined,
  flushing: false,
  windowListenersInstalled: false,
  _onWindowError: undefined,
  _onUnhandledRejection: undefined,
}

export function redactSecrets(input: string): string {
  const s = String(input ?? '')
  // scheme://user:pass@host -> scheme://<redacted>@host
  return s.replace(
    /([a-zA-Z][a-zA-Z0-9+.-]*:\/\/)([^/@\s:]+):([^/@\s]+)@/g,
    '$1<redacted>@',
  )
}

function safeMeta(meta: unknown): unknown {
  if (meta instanceof Error) {
    return {
      name: meta.name,
      message: meta.message,
      stack: meta.stack,
    }
  }
  return meta
}

function safeStringify(meta: unknown): string | undefined {
  if (meta === undefined) return undefined
  try {
    return JSON.stringify(safeMeta(meta), (_k, v) => {
      if (typeof v === 'string') return redactSecrets(v)
      return v
    })
  } catch {
    try {
      return JSON.stringify({ meta: redactSecrets(String(meta)) })
    } catch {
      return undefined
    }
  }
}

function nowIso() {
  return new Date().toISOString()
}

function formatLine(level: Level, message: string, meta?: unknown) {
  const msg = redactSecrets(String(message ?? ''))
  const m = safeStringify(meta)
  const suffix = m ? ` ${m}` : ''
  return `${nowIso()} ${level} ${msg}${suffix}\n`
}

async function safeStat(path: string) {
  try {
    return await Filesystem.stat({ directory: LOG_FILE_DIRECTORY, path })
  } catch {
    return undefined
  }
}

export async function ensureLogFileExists(initialLine?: string) {
  if (state.platform !== 'android') return
  try {
    await Filesystem.mkdir({ directory: LOG_FILE_DIRECTORY, path: LOG_DIR, recursive: true })
  } catch {
    // ignore
  }

  const st = await safeStat(LOG_FILE_PATH)
  if (st) return
  try {
    const line = initialLine ? `${redactSecrets(initialLine)}\n` : `${nowIso()} INFO [log] created\n`
    await Filesystem.writeFile({
      directory: LOG_FILE_DIRECTORY,
      path: LOG_FILE_PATH,
      data: line,
      encoding: Encoding.UTF8,
    })
  } catch {
    // ignore
  }
}

async function rotateIfNeeded() {
  if (state.platform !== 'android') return
  const st: any = await safeStat(LOG_FILE_PATH)
  const size = st && typeof st.size === 'number' ? st.size : 0
  if (size <= state.maxBytes) return

  try {
    try {
      await Filesystem.deleteFile({ directory: LOG_FILE_DIRECTORY, path: ROTATED_LOG_FILE_PATH })
    } catch {
      // ignore
    }
    try {
      await Filesystem.rename({
        directory: LOG_FILE_DIRECTORY,
        from: LOG_FILE_PATH,
        to: ROTATED_LOG_FILE_PATH,
      } as any)
    } catch {
      // If rename isn't available or fails, just truncate.
    }
    await Filesystem.writeFile({
      directory: LOG_FILE_DIRECTORY,
      path: LOG_FILE_PATH,
      data: `${nowIso()} INFO [log] rotated\n`,
      encoding: Encoding.UTF8,
    })
  } catch {
    // ignore
  }
}

function scheduleFlush() {
  if (!state.fileEnabled) return
  if (state.timer) return
  state.timer = setTimeout(() => {
    state.timer = undefined
    void flush()
  }, state.flushIntervalMs)
}

async function flush() {
  if (!state.fileEnabled) return
  if (state.flushing) return
  if (state.queue.length === 0) return

  state.flushing = true
  const batch = state.queue.splice(0, state.queue.length)

  try {
    await ensureLogFileExists()
    await rotateIfNeeded()
    await Filesystem.appendFile({
      directory: LOG_FILE_DIRECTORY,
      path: LOG_FILE_PATH,
      data: batch.join(''),
      encoding: Encoding.UTF8,
    })
  } catch {
    // Best-effort: put lines back at the front.
    state.queue = batch.concat(state.queue)
  } finally {
    state.flushing = false
  }
}

function logToConsole(level: Level, message: string, meta?: unknown) {
  try {
    const msg = redactSecrets(String(message ?? ''))
    const metaStr = safeStringify(meta)
    let metaOut: unknown = undefined
    if (metaStr) {
      try {
        metaOut = JSON.parse(metaStr)
      } catch {
        metaOut = metaStr
      }
    }

    if (level === 'INFO') {
      if (metaOut === undefined) console.info(msg)
      else console.info(msg, metaOut)
    } else if (level === 'WARN') {
      if (metaOut === undefined) console.warn(msg)
      else console.warn(msg, metaOut)
    } else {
      if (metaOut === undefined) console.error(msg)
      else console.error(msg, metaOut)
    }
  } catch {
    // ignore
  }
}

function enqueue(level: Level, message: string, meta?: unknown) {
  logToConsole(level, message, meta)
  if (!state.fileEnabled) return

  state.queue.push(formatLine(level, message, meta))
  if (state.queue.length >= state.maxQueueLines) {
    // Flush soon; keep it async to avoid blocking the UI thread.
    if (state.timer) {
      clearTimeout(state.timer)
      state.timer = undefined
    }
    void flush()
    return
  }
  scheduleFlush()
}

export const logger = {
  info(message: string, meta?: unknown) {
    enqueue('INFO', message, meta)
  },
  warn(message: string, meta?: unknown) {
    enqueue('WARN', message, meta)
  },
  error(message: string, meta?: unknown) {
    enqueue('ERROR', message, meta)
  },
}

function installWindowErrorCapture() {
  if (state.windowListenersInstalled) return
  state.windowListenersInstalled = true

  state._onWindowError = (ev: any) => {
    try {
      logger.error('[global] error', {
        message: ev?.message,
        filename: ev?.filename,
        lineno: ev?.lineno,
        colno: ev?.colno,
        stack: ev?.error?.stack,
      })
    } catch {
      // ignore
    }
  }

  state._onUnhandledRejection = (ev: any) => {
    try {
      const r = ev?.reason
      logger.error('[global] unhandledrejection',
        r instanceof Error
          ? { name: r.name, message: r.message, stack: r.stack }
          : { reason: r },
      )
    } catch {
      // ignore
    }
  }

  window.addEventListener('error', state._onWindowError)
  window.addEventListener('unhandledrejection', state._onUnhandledRejection as any)
}

export async function initLogger({ platform }: { platform: string }): Promise<void> {
  state.platform = String(platform || 'web')
  state.initialized = true

  // Always log to console; file logging only on Android.
  state.fileEnabled = state.platform === 'android'
  if (!state.fileEnabled) return

  try {
    await ensureLogFileExists(`${nowIso()} INFO [log] init platform=${state.platform}`)
  } catch {
    // ignore
  }

  // If Filesystem isn't available, keep going with console-only.
  try {
    await rotateIfNeeded()
  } catch {
    // ignore
  }

  try {
    installWindowErrorCapture()
  } catch {
    // ignore
  }
}

export function shutdownLogger() {
  if (state.timer) {
    clearTimeout(state.timer)
    state.timer = undefined
  }

  try {
    if (state._onWindowError) {
      window.removeEventListener('error', state._onWindowError)
    }
    if (state._onUnhandledRejection) {
      window.removeEventListener('unhandledrejection', state._onUnhandledRejection as any)
    }
  } catch {
    // ignore
  }

  state.queue = []
  state.flushing = false
  state.fileEnabled = false
  state.initialized = false
  state.windowListenersInstalled = false
  state._onWindowError = undefined
  state._onUnhandledRejection = undefined
}
