import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    // pouchdb-browser's bundle has a CommonJS require('events') that its
    // classes extend (EventEmitter). Pre-bundle the real package so the
    // dep optimizer links it instead of stubbing it as a Node built-in
    // (a stub makes the app crash with "Class extends value ... is not a
    // constructor" at startup).
    include: ['events'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
