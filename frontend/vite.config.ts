import react from '@vitejs/plugin-react'
// vitest's re-export of Vite's own `defineConfig`, which additionally types
// the `test` block below.
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Page-level tests render whole routes; the default 5s is tight on a cold
    // CI runner once jsdom, React and the router are all warming up at once.
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      // Presentation-only: `main.tsx` is the mount call, the type modules are
      // erased at build time, and `Depth` is pure decoration driven by pointer
      // and scroll events that jsdom does not produce meaningfully.
      exclude: ['src/main.tsx', 'src/**/*.d.ts', 'src/test/**', 'src/components/Depth.tsx'],
    },
  },
})
