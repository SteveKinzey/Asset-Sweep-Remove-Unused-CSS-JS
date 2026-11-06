import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The suites use test/expect/describe as globals, as they did under Jest.
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // lcov feeds the Codecov upload in CI; text is the console summary.
      reporter: ['text', 'lcov'],
    },
  },
})
