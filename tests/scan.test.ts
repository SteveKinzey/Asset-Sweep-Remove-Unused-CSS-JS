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

describe('inline <style> blocks in HTML are scanned for definitions', () => {
  test('an unused rule inside an inline <style> block is reported, attributed to the .html file', async () => {
    const dir = await project({
      'index.html': [
        '<html><head><style>',
        '.inline-unused { color: red; }',
        '</style></head><body></body></html>',
      ].join('\n'),
    })
    const result = await scan(dir)

    expect(result.findings.map(f => f.name)).toEqual(['inline-unused'])
    expect(result.findings[0]?.file).toMatch(/index\.html$/)
  })

  test('a rule inside an inline <style> block whose class is used in the same document is NOT reported', async () => {
    const dir = await project({
      'index.html': [
        '<html><head><style>',
        '.inline-used { color: red; }',
        '</style></head>',
        '<body><div class="inline-used"></div></body></html>',
      ].join('\n'),
    })
    const result = await scan(dir)

    expect(result.findings.map(f => f.name)).not.toContain('inline-used')
  })

  // Line-offset trap, exercised end to end through scan(): the <style>
  // block sits well below line 1, so the finding's reported line must be
  // its true position in the .html file — not line 1, and not its offset
  // within the extracted <style> text alone.
  test('a finding inside a <style> block starting around line 5 reports its true line in the .html file', async () => {
    const dir = await project({
      'index.html': [
        '<html>',           // 1
        '<head>',            // 2
        '<title>x</title>',  // 3
        '<meta charset="utf-8">', // 4
        '<style>',           // 5
        '.offset-unused { color: red; }', // 6
        '</style>',          // 7
        '</head><body></body></html>', // 8
      ].join('\n'),
    })
    const result = await scan(dir)
    const finding = result.findings.find(f => f.name === 'offset-unused')

    expect(finding).toBeDefined()
    expect(finding?.line).toBe(6)
  })

  test('multiple <style> blocks in one document are all scanned', async () => {
    const dir = await project({
      'index.html': [
        '<html><head>',
        '<style>.first-unused { color: red; }</style>',
        '</head><body>',
        '<style>',
        '.second-unused { color: blue; }',
        '</style>',
        '</body></html>',
      ].join('\n'),
    })
    const result = await scan(dir)

    expect(result.findings.map(f => f.name).sort())
      .toEqual(['first-unused', 'second-unused'])
  })

  test('totalCssSelectors includes selectors defined in inline <style> blocks', async () => {
    const dir = await project({
      'styles.css': '.from-css { color: red; }',
      'index.html': [
        '<html><head><style>',
        '.from-inline-style { color: blue; }',
        '</style></head><body></body></html>',
      ].join('\n'),
    })
    const result = await scan(dir)

    // Both the .css definition and the inline <style> definition must be
    // counted, since --threshold's ratio is unused/totalCssSelectors —
    // an inline-only rule that isn't counted here would silently make
    // the threshold gate less strict than it claims to be.
    expect(result.summary.totalCssSelectors).toBe(2)
  })
})

describe('estimatedSavings sums each rule once, not once per selector it defines', () => {
  // `.parent .child { ... }` defines two selectors in one rule. Each
  // unused selector still gets its own Finding (that's correct — the
  // report should list both), but the rule itself only ships once, so
  // deleting it only saves its bytes once.
  test('a rule that defines two unused selectors counts its bytes once, not twice', async () => {
    const ruleText = '.parent .child { color: red; padding: 1px }'
    const dir = await project({
      'styles.css': ruleText,
      'index.html': '<div></div>',
    })
    const result = await scan(dir)

    expect(result.findings.map(f => f.name).sort()).toEqual(['child', 'parent'])

    const ruleBytes = Buffer.byteLength(ruleText, 'utf8')
    for (const f of result.findings) {
      expect(f.bytes).toBe(ruleBytes) // per-finding bytes: the containing rule's size
    }
    // Aggregate: ONE rule's worth of savings, not two.
    expect(result.summary.estimatedSavings).toBe(`${ruleBytes} B`)
  })

  test('two genuinely separate unused rules still sum to both', async () => {
    const oneText = '.one { color: red }'
    const twoText = '.two { color: blue }'
    const dir = await project({
      'styles.css': `${oneText}\n${twoText}`,
      'index.html': '<div></div>',
    })
    const result = await scan(dir)

    const total = Buffer.byteLength(oneText, 'utf8') + Buffer.byteLength(twoText, 'utf8')
    expect(result.summary.estimatedSavings).toBe(`${total} B`)
  })
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

describe('--threshold validation', () => {
  // A 100%-unused project makes the gate observable: any threshold below
  // 100 must trip it (exit 1), so if a bad --threshold value slipped past
  // validation and got coerced to something that disables the check (e.g.
  // NaN, where `ratio > NaN` is always false), this project would prove it
  // by wrongly exiting 0.
  async function allUnusedProject() {
    return project({
      'styles.css': '.ghost { color: red }',
      'index.html': '<div></div>',
    })
  }

  test('a non-numeric --threshold exits 2 rather than silently disabling the gate', async () => {
    const dir = await allUnusedProject()
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(await main(['scan', dir, '--threshold', 'abc'])).toBe(2)
    spy.mockRestore()
  })

  test('a bare --threshold with no value exits 2 rather than being coerced to 1', async () => {
    const dir = await allUnusedProject()
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(await main(['scan', dir, '--threshold'])).toBe(2)
    spy.mockRestore()
  })

  test('a negative --threshold exits 2', async () => {
    const dir = await allUnusedProject()
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(await main(['scan', dir, '--threshold', '-5'])).toBe(2)
    spy.mockRestore()
  })

  test('a --threshold above 100 exits 2', async () => {
    const dir = await allUnusedProject()
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(await main(['scan', dir, '--threshold', '101'])).toBe(2)
    spy.mockRestore()
  })

  test('--threshold 0 is accepted and fails a project with any unused selectors', async () => {
    const dir = await allUnusedProject()
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {})
    expect(await main(['scan', dir, '--threshold', '0'])).toBe(1)
    spy.mockRestore()
  })

  test('--threshold 100 is accepted and never fails, since ratio can never exceed 100', async () => {
    const dir = await allUnusedProject()
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {})
    expect(await main(['scan', dir, '--threshold', '100'])).toBe(0)
    spy.mockRestore()
  })
})

describe('a usage-source read failure must never let the exit code report success', () => {
  // .only-in-html is genuinely used, but the only file that proves that is
  // made unreadable, so the scan cannot know it's safe. Its finding is
  // downgraded to 'low' by C2 — these tests check that low finding, and
  // usageSourceErrors, still force a non-zero exit even when threshold or
  // confidence filtering would otherwise have let the run pass.
  async function projectWithUnreadableHtml() {
    const dir = await project({
      'styles.css': '.only-in-html { color: red }',
      'index.html': '<div class="only-in-html"></div>',
    })
    const htmlPath = join(dir, 'index.html')
    await chmod(htmlPath, 0o000)
    return { dir, htmlPath }
  }

  test('an unreadable usage-source file exits 1 under --min-confidence medium, not 0 (regression)', async () => {
    const { dir, htmlPath } = await projectWithUnreadableHtml()
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const code = await main(['scan', dir, '--min-confidence', 'medium'])
      expect(code).toBe(1)
    } finally {
      spy.mockRestore()
      await chmod(htmlPath, 0o644)
    }
  })

  test('an unreadable usage-source file exits 1 under --threshold 100', async () => {
    const { dir, htmlPath } = await projectWithUnreadableHtml()
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const code = await main(['scan', dir, '--threshold', '100'])
      expect(code).toBe(1)
    } finally {
      spy.mockRestore()
      await chmod(htmlPath, 0o644)
    }
  })

  test('an unreadable usage-source file exits 1 under --min-confidence high (zero surviving findings)', async () => {
    const { dir, htmlPath } = await projectWithUnreadableHtml()
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const code = await main(['scan', dir, '--min-confidence', 'high'])
      expect(code).toBe(1)
    } finally {
      spy.mockRestore()
      await chmod(htmlPath, 0o644)
    }
  })

  test('a scan with no usage-source errors is unaffected: 0 under threshold, 1 over, 2 on fatal error', async () => {
    const dir = await project({
      'styles.css': '.ghost { color: red }',
      'index.html': '<div></div>',
    })
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(await main(['scan', dir, '--threshold', '100'])).toBe(0)
      expect(await main(['scan', dir, '--threshold', '0'])).toBe(1)
      expect(await main(['scan', dir, '--threshold', 'abc'])).toBe(2)
    } finally {
      logSpy.mockRestore()
      errSpy.mockRestore()
    }
  })
})
