import { chmod, mkdtemp, writeFile } from 'node:fs/promises'
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

test('an unreadable usage-source (.html) file downgrades findings to low confidence, not a false "medium"', async () => {
  const dir = await project({
    'styles.css': '.only-in-html { color: red }',
    'index.html': '<div class="only-in-html"></div>',
  })
  const htmlPath = join(dir, 'index.html')
  await chmod(htmlPath, 0o000) // simulate an unreadable file

  try {
    const result = await scan(dir)

    const finding = result.findings.find(f => f.name === 'only-in-html')
    expect(finding).toBeDefined()
    expect(finding?.confidence).toBe('low')
    expect(finding?.reason).toMatch(/usage-source/i)
    expect(finding?.reason).toMatch(/could not be read/i)
    expect(result.summary.usageSourceErrors).toBe(1)
  } finally {
    await chmod(htmlPath, 0o644) // restore, so temp-dir cleanup can remove it
  }
})

test('a failed .css file alone does not downgrade findings, since it only loses definitions', async () => {
  const dir = await project({
    'good.css': '.ghost { color: blue }',
    'broken.css': '.also-fine { color: red }',
    'index.html': '<div></div>',
  })
  const cssPath = join(dir, 'broken.css')
  await chmod(cssPath, 0o000) // simulate an unreadable .css (not a usage source)

  try {
    const result = await scan(dir)

    const finding = result.findings.find(f => f.name === 'ghost')
    expect(finding).toBeDefined()
    expect(finding?.confidence).toBe('medium')
    expect(result.summary.usageSourceErrors).toBe(0)
    expect(result.summary.errors).toBe(1)
  } finally {
    await chmod(cssPath, 0o644)
  }
})
