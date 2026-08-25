// tests/integration.test.ts
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { scan } from '../src/scan.js'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = join(here, 'fixtures', 'basic')

test('reports exactly the unused selectors, and nothing else', async () => {
  const names = (await scan(fixture)).findings.map(f => f.name).sort()
  expect(names).toEqual(['ghost', 'ghost-id'])
})

test('safelisted js-* classes are excluded', async () => {
  const names = (await scan(fixture)).findings.map(f => f.name)
  expect(names).not.toContain('js-runtime')
})

test('a selector appearing only in a comment is never reported', async () => {
  const names = (await scan(fixture)).findings.map(f => f.name)
  expect(names).not.toContain('commented-out')
})

test('no Phase 1 finding claims high confidence', async () => {
  for (const f of (await scan(fixture)).findings) {
    expect(f.confidence).not.toBe('high')
  }
})

test('a finding reports the actual line its selector sits on in the CSS', async () => {
  // .ghost is declared on line 2 of styles.css, not line 1. A parser that
  // (wrongly) reports every token as line 1 would pass every other
  // assertion in this file while being silently useless for editor
  // "jump to definition" output. Assert against a non-line-1 selector so
  // that regression is actually caught.
  const findings = (await scan(fixture)).findings
  const ghost = findings.find(f => f.name === 'ghost')
  expect(ghost).toBeDefined()
  expect(ghost?.line).toBe(2)
})
