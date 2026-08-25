import { isSafelisted } from '../../src/analyze/safelist.js'
import { DEFAULT_CONFIG } from '../../src/config/defaults.js'
import type { SelectorDef } from '../../src/types.js'

const def = (name: string, raw = `.${name}`): SelectorDef => ({
  kind: 'class', name, raw, file: 'a.css', line: 1, column: 1, bytes: 10,
})

test('nothing is safelisted by default', () => {
  expect(isSafelisted(def('x'), DEFAULT_CONFIG)).toBe(false)
})

test('ignoreClasses matches exact names', () => {
  const cfg = { ...DEFAULT_CONFIG, ignoreClasses: ['keep'] }
  expect(isSafelisted(def('keep'), cfg)).toBe(true)
  expect(isSafelisted(def('other'), cfg)).toBe(false)
})

test('ignoreClasses supports glob wildcards', () => {
  const cfg = { ...DEFAULT_CONFIG, ignoreClasses: ['js-*', 'wp-*'] }
  expect(isSafelisted(def('js-toggle'), cfg)).toBe(true)
  expect(isSafelisted(def('wp-block'), cfg)).toBe(true)
  expect(isSafelisted(def('unrelated'), cfg)).toBe(false)
})

test('wildcard does not match across a literal prefix boundary', () => {
  const cfg = { ...DEFAULT_CONFIG, ignoreClasses: ['js-*'] }
  expect(isSafelisted(def('not-js-toggle'), cfg)).toBe(false)
})

test('ignoreSelectors matches the full raw selector', () => {
  const cfg = { ...DEFAULT_CONFIG, ignoreSelectors: ['[data-toggle]'] }
  expect(isSafelisted(def('x', '[data-toggle]'), cfg)).toBe(true)
})

test('? is treated as a literal character, not a single-char wildcard', () => {
  const cfg = { ...DEFAULT_CONFIG, ignoreClasses: ['abc?'] }
  expect(isSafelisted(def('ab'), cfg)).toBe(false)
  expect(isSafelisted(def('abc?'), cfg)).toBe(true)
})
