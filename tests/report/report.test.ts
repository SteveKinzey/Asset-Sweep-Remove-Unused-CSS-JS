import { renderJson } from '../../src/report/json.js'
import { renderText } from '../../src/report/text.js'
import type { ScanResult } from '../../src/types.js'

const result: ScanResult = {
  summary: { filesAnalyzed: 2, unusedCss: 1, unusedJs: 0,
             estimatedSavings: '1.2 KB', errors: 0, semanticMode: false },
  findings: [{ type: 'css-selector', name: 'ghost', file: 'a.css', line: 3,
               column: 1, bytes: 1200, confidence: 'medium',
               reason: 'JavaScript was not analyzed.' }],
  errors: [],
}

test('JSON report is valid JSON preserving the result shape', () => {
  const parsed = JSON.parse(renderJson(result))
  expect(parsed.summary.unusedCss).toBe(1)
  expect(parsed.findings[0].name).toBe('ghost')
})

test('text report names the selector, its file and line', () => {
  const out = renderText(result)
  expect(out).toContain('ghost')
  expect(out).toContain('a.css:3')
})

test('text report states the confidence and the reason', () => {
  const out = renderText(result)
  expect(out.toLowerCase()).toContain('medium')
  expect(out).toContain('JavaScript was not analyzed.')
})

test('a clean project reports no unused assets rather than an empty table', () => {
  const clean: ScanResult = {
    summary: { ...result.summary, unusedCss: 0 }, findings: [], errors: [],
  }
  expect(renderText(clean)).toMatch(/no unused/i)
})

test('a group with two findings with the same reason prints one why line', () => {
  const sameReasons: ScanResult = {
    summary: { ...result.summary, unusedCss: 2 },
    findings: [
      { type: 'css-selector', name: 'ghost', file: 'a.css', line: 3,
        column: 1, bytes: 1200, confidence: 'medium',
        reason: 'JavaScript was not analyzed.' },
      { type: 'css-selector', name: 'unused', file: 'a.css', line: 5,
        column: 1, bytes: 300, confidence: 'medium',
        reason: 'JavaScript was not analyzed.' }
    ],
    errors: [],
  }
  const out = renderText(sameReasons)
  // Should print both findings
  expect(out).toContain('ghost')
  expect(out).toContain('unused')
  // Should have exactly one "why:" line for this group
  const whyLines = out.split('\n').filter(l => l.includes('why:'))
  expect(whyLines.length).toBe(1)
  expect(whyLines[0]).toContain('JavaScript was not analyzed.')
})

test('a group with two findings with different reasons prints each reason with its finding', () => {
  const differentReasons: ScanResult = {
    summary: { ...result.summary, unusedCss: 2 },
    findings: [
      { type: 'css-selector', name: 'ghost', file: 'a.css', line: 3,
        column: 1, bytes: 1200, confidence: 'medium',
        reason: 'JavaScript was not analyzed.' },
      { type: 'css-selector', name: 'unused', file: 'a.css', line: 5,
        column: 1, bytes: 300, confidence: 'medium',
        reason: 'Not used in HTML.' }
    ],
    errors: [],
  }
  const out = renderText(differentReasons)
  // Should have both reasons (old code would only have the first)
  expect(out).toContain('JavaScript was not analyzed.')
  expect(out).toContain('Not used in HTML.')
  // Should have both findings
  expect(out).toContain('ghost')
  expect(out).toContain('unused')
})
