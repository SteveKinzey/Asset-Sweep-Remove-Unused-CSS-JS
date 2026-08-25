import type { Finding } from '../src/types.js'

test('Finding carries a reason explaining its confidence', () => {
  const f: Finding = {
    type: 'css-selector', name: 'old-header', file: 'a.css',
    line: 1, column: 1, bytes: 42,
    confidence: 'medium', reason: 'JavaScript was not analyzed.',
  }
  expect(f.reason).not.toHaveLength(0)
})
