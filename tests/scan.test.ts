import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { jest } from '@jest/globals'
import { scan } from '../src/scan.js'
import { main } from '../src/cli.js'

async function project(files: Record<string, string>) {
  const dir = await mkdtemp(join(tmpdir(), 'as-'))
  for (const [name, body] of Object.entries(files)) {
    await writeFile(join(dir, name), body)
  }
  return dir
}

test('reports a selector defined in CSS but absent from HTML', async () => {
  const dir = await project({
    'styles.css': '.used { color: red }\n.ghost { color: blue }',
    'index.html': '<div class="used"></div>',
  })
  const result = await scan(dir)
  expect(result.findings.map(f => f.name)).toEqual(['ghost'])
  expect(result.summary.unusedCss).toBe(1)
})

test('a malformed file is recorded as an error without aborting the scan', async () => {
  const dir = await project({
    'broken.css': '.a { color: red',      // unclosed block
    'good.css': '.ghost { color: red }',
    'index.html': '<div></div>',
  })
  const result = await scan(dir)
  expect(result.summary.filesAnalyzed).toBeGreaterThan(0)
  expect(result.findings.map(f => f.name)).toContain('ghost')
  expect(result.errors).toHaveLength(1)
  expect(result.errors[0].file).toContain('broken.css')
  expect(result.summary.errors).toBe(1)
})

test('filesAnalyzed only counts files actually parsed (.css/.html), not every discovered file', async () => {
  const dir = await project({
    'styles.css': '.ghost { color: blue }',
    'index.html': '<div></div>',
    'app.js': 'console.log("not parsed in Phase 1")',
  })
  const result = await scan(dir)
  // Only styles.css and index.html were parsed; app.js is discovered but
  // not analyzed in Phase 1, so it must not inflate filesAnalyzed.
  expect(result.summary.filesAnalyzed).toBe(2)
})

test('finding file paths are relative to the current working directory, not the scan root', async () => {
  const dir = await project({
    'styles.css': '.ghost { color: blue }',
    'index.html': '<div></div>',
  })
  const result = await scan(dir)
  const finding = result.findings[0]
  expect(finding.file).not.toMatch(/^\//)
  expect(resolve(process.cwd(), finding.file)).toBe(join(dir, 'styles.css'))
})

test('--threshold is a percentage of unused CSS selectors, not files', async () => {
  const dir = await project({
    'styles.css': '.a{color:red}\n.b{color:red}\n.c{color:red}\n.d{color:blue}',
    'index.html': '<div class="a b c"></div>',
  })
  const spy = jest.spyOn(console, 'log').mockImplementation(() => {})
  // 1 of 4 selectors unused = 25%: trips a 20% threshold, not a 30% one.
  const failCode = await main(['scan', dir, '--threshold', '20'])
  const passCode = await main(['scan', dir, '--threshold', '30'])
  spy.mockRestore()
  expect(failCode).toBe(1)
  expect(passCode).toBe(0)
})

test('semanticMode is false in Phase 1', async () => {
  const dir = await project({ 'a.css': '.x{}', 'i.html': '<p></p>' })
  expect((await scan(dir)).summary.semanticMode).toBe(false)
})

test('zero matching files throws, so a wrong glob cannot pass silently', async () => {
  const dir = await project({ 'notes.txt': 'nothing here' })
  await expect(scan(dir)).rejects.toThrow(/no files/i)
})

test('--min-confidence high hides Phase 1 medium findings', async () => {
  const dir = await project({
    'styles.css': '.ghost { color: blue }',
    'index.html': '<div></div>',
  })
  const logged: string[] = []
  const spy = jest.spyOn(console, 'log')
    .mockImplementation(m => { logged.push(String(m)) })
  await main(['scan', dir, '--min-confidence', 'high'])
  spy.mockRestore()
  expect(logged.join('\n')).not.toContain('ghost')
})

test('an invalid --min-confidence value exits 2', async () => {
  const dir = await project({ 'a.css': '.x{}', 'i.html': '<p></p>' })
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
  expect(await main(['scan', dir, '--min-confidence', 'nonsense'])).toBe(2)
  spy.mockRestore()
})
