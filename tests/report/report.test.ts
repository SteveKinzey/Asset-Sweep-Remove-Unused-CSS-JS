import { renderJson } from '../../src/report/json.js'
import { renderText } from '../../src/report/text.js'
import type { ScanResult } from '../../src/types.js'

const result: ScanResult = {
  summary: { filesAnalyzed: 2, unusedCss: 1, unusedJs: 0,
             estimatedSavings: '1.2 KB', errors: 0, semanticMode: false,
             totalCssSelectors: 4, usageSourceErrors: 0 },
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

test('a class finding renders with a . sigil and an id finding renders with a # sigil', () => {
  const mixed: ScanResult = {
    summary: { ...result.summary, unusedCss: 2, totalCssSelectors: 5 },
    findings: [
      { type: 'css-selector', name: 'ghost', file: 'styles.css', line: 2,
        column: 1, bytes: 22, confidence: 'medium',
        reason: 'JavaScript was not analyzed.', selectorKind: 'class' },
      { type: 'css-selector', name: 'ghost-id', file: 'styles.css', line: 6,
        column: 1, bytes: 25, confidence: 'medium',
        reason: 'JavaScript was not analyzed.', selectorKind: 'id' },
    ],
    errors: [],
  }
  const out = renderText(mixed)
  // Assert the exact rendered token, so a regression to a hardcoded `.`
  // prefix on every line (the bug this test guards against) fails it.
  expect(out).toContain('.ghost  styles.css:2')
  expect(out).toContain('#ghost-id  styles.css:6')
  expect(out).not.toContain('.ghost-id')
})

test('a scan with unreadable usage-source files prints a visible warning above the findings', () => {
  const withUsageErrors: ScanResult = {
    summary: { ...result.summary, usageSourceErrors: 1 },
    findings: result.findings,
    errors: [],
  }
  const out = renderText(withUsageErrors)
  expect(out).toMatch(/WARNING/)
  expect(out).toMatch(/1 usage-source file/i)
  // The warning must appear before the findings it's warning about.
  expect(out.indexOf('WARNING')).toBeLessThan(out.indexOf('ghost'))
})

test('a clean scan with no usage-source errors prints no warning line', () => {
  const out = renderText(result)
  expect(out).not.toMatch(/WARNING/)
})
