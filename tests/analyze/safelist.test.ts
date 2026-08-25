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

test('an exact ignoreSelectors pattern (no wildcard) still matches exactly, as before', () => {
  const cfg = { ...DEFAULT_CONFIG, ignoreSelectors: ['[data-toggle]'] }
  expect(isSafelisted(def('x', '[data-toggle]'), cfg)).toBe(true)
  expect(isSafelisted(def('x', 'totally-unrelated'), cfg)).toBe(false)
})

// Regression test for a real bug: unanchored matching let a short pattern
// like "a" swallow every selector containing that substring — ".alpha"
// AND ".beta" both got silently safelisted. A false positive is loud (the
// user sees a wrong finding); a safelist silently eating real dead CSS is
// not, and is strictly worse. ignoreSelectors must be anchored just like
// ignoreClasses so a short/generic pattern can't match everything.
test('a short ignoreSelectors pattern does not swallow unrelated selectors', () => {
  const cfg = { ...DEFAULT_CONFIG, ignoreSelectors: ['a'] }
  expect(isSafelisted(def('alpha', '.alpha'), cfg)).toBe(false)
  expect(isSafelisted(def('beta', '.beta'), cfg)).toBe(false)
})

// The documented Vue scoped-styles recipe: under anchored matching,
// "[data-v-*]" alone cannot match "[data-v-1] .scoped" (it doesn't cover
// the trailing " .scoped"). "[data-v-*] *" covers the whole selector and
// is the pattern actually documented in the README.
test('the documented Vue scoped-styles pattern safelists a compound data-v selector', () => {
  const cfg = { ...DEFAULT_CONFIG, ignoreSelectors: ['[data-v-*] *'] }
  expect(isSafelisted(def('scoped', '[data-v-1] .scoped'), cfg)).toBe(true)
})

test('the documented Vue scoped-styles pattern does not safelist an unrelated selector', () => {
  const cfg = { ...DEFAULT_CONFIG, ignoreSelectors: ['[data-v-*] *'] }
  expect(isSafelisted(def('alpha', '.alpha'), cfg)).toBe(false)
})

test('a non-matching ignoreSelectors glob does not safelist', () => {
  const cfg = { ...DEFAULT_CONFIG, ignoreSelectors: ['[data-v-*] *'] }
  expect(isSafelisted(def('x', '.unrelated'), cfg)).toBe(false)
})

test('? is treated as a literal character, not a single-char wildcard', () => {
  const cfg = { ...DEFAULT_CONFIG, ignoreClasses: ['abc?'] }
  expect(isSafelisted(def('ab'), cfg)).toBe(false)
  expect(isSafelisted(def('abc?'), cfg)).toBe(true)
})
