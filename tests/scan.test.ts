import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
