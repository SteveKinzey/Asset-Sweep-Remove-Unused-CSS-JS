import { unusedRatio } from '../../src/analyze/ratio.js'

test('computes a percentage of unused selectors over total selectors', () => {
  expect(unusedRatio(1, 4)).toBe(25)
  expect(unusedRatio(12, 48)).toBe(25)
})

test('returns 0, not NaN, when total is 0', () => {
  expect(unusedRatio(0, 0)).toBe(0)
  expect(Number.isNaN(unusedRatio(0, 0))).toBe(false)
})

test('returns 100 when everything defined is unused', () => {
  expect(unusedRatio(3, 3)).toBe(100)
})
