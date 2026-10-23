// Boot smoke test: imports the real app entry (src/main.ts) and asserts the
// app actually mounts. Guards against module-level initialization failures
// (e.g. broken dependency bundling/interop) that leave a black screen while
// every other test stays green.
import { describe, it, expect, vi, afterEach } from 'vitest'

describe('app boot (main.ts)', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('mounts the app without module initialization errors', async () => {
    document.body.innerHTML = '<div id="app"></div>'

    const errors: string[] = []
    const onError = (e: ErrorEvent) => errors.push(String(e.error ?? e.message))
    window.addEventListener('error', onError)

    try {
      await import('@/main')

      await vi.waitFor(() => {
        const root = document.querySelector('#app')
        expect(root, 'app root element not mounted').not.toBeNull()
        expect(root!.childElementCount, 'app root has no rendered content').toBeGreaterThan(0)
      })

      expect(errors).toEqual([])
    } finally {
      window.removeEventListener('error', onError)
    }
  })
})
