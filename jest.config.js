export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  // tsconfig.test.json (not the base tsconfig.json) is what ts-jest
  // compiles test files against: it's the only place `jest`/`expect`/
  // `describe` globals are declared as ambient types, so a typo like a
  // stray `expect(...)` left in src/ fails type-check instead of silently
  // compiling (see tsconfig.json's `types` field).
  transform: { '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.test.json' }] },
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
}
