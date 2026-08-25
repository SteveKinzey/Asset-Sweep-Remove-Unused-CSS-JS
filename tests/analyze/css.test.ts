import { analyzeCss } from '../../src/analyze/css.js'
import { DEFAULT_CONFIG } from '../../src/config/defaults.js'
import type { SelectorDef, UsageToken } from '../../src/types.js'

const def = (name: string): SelectorDef => ({
  kind: 'class', name, raw: `.${name}`, file: 'a.css',
  line: 1, column: 1, bytes: 10,
})
const use = (value: string): UsageToken => ({
  value, kind: 'class', file: 'i.html', line: 1, column: 1,
})

test('a used selector produces no finding', () => {
  expect(analyzeCss([def('used')], [use('used')], DEFAULT_CONFIG)).toHaveLength(0)
})

test('an unused selector is reported', () => {
  const findings = analyzeCss([def('ghost')], [use('other')], DEFAULT_CONFIG)
  expect(findings.map(f => f.name)).toEqual(['ghost'])
})

test('Phase 1 never reports high confidence, because JS is not analyzed', () => {
  const [finding] = analyzeCss([def('ghost')], [], DEFAULT_CONFIG)
  expect(finding.confidence).toBe('medium')
  expect(finding.reason).toMatch(/JavaScript/i)
})

test('safelisted selectors never appear in findings', () => {
  const cfg = { ...DEFAULT_CONFIG, ignoreClasses: ['ghost'] }
  expect(analyzeCss([def('ghost')], [], cfg)).toHaveLength(0)
})

test('id usage does not mark a same-named class as used', () => {
  const idUse: UsageToken = { ...use('name'), kind: 'id' }
  expect(analyzeCss([def('name')], [idUse], DEFAULT_CONFIG)).toHaveLength(1)
})

test('every finding carries a non-empty reason', () => {
  for (const f of analyzeCss([def('a'), def('b')], [], DEFAULT_CONFIG)) {
    expect(f.reason.length).toBeGreaterThan(0)
  }
})
