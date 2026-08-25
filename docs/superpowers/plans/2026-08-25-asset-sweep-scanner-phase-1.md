# Asset Sweep Scanner — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working `asset-sweep scan <dir>` that reports unused CSS selectors from HTML usage, with config, safelist, confidence scoring, text and JSON reports, and correct exit codes.

**Architecture:** Six-stage pipeline — discover, parse, collect, cross-reference, score, report. Parsers emit facts (`SelectorDef`, `UsageToken`); analyzers make judgments. Phase 1 wires the full pipeline end to end with only the CSS and HTML parsers present, so later phases add parsers without touching analysis logic.

**Tech Stack:** TypeScript 5 strict, ESM (`type: module`, `module: NodeNext`), Node ≥18, Jest + ts-jest ESM preset, postcss, postcss-selector-parser, parse5, glob, minimist, chalk.

**Spec:** `docs/superpowers/specs/2026-08-25-asset-sweep-scanner-design.md`

## Global Constraints

- Node ≥18.0.0, npm ≥9.0.0. TypeScript `strict: true`.
- ESM only. `package.json` has `"type": "module"`; `tsconfig` uses `module: NodeNext`. **All relative imports in `.ts` source must carry a `.js` extension** (`./types.js`), which is how NodeNext resolves TypeScript ESM.
- Jest runs under `NODE_OPTIONS=--experimental-vm-modules`.
- `package.json` keeps `"private": true` for all of Phase 1. It comes off only when the scanner genuinely works (spec §13).
- Every `Finding` carries a `reason` string explaining its confidence in one sentence.
- **Phase 1 confidence cap:** no finding may be scored `high`. Spec §7 defines `high` as requiring that no dynamic class construction exists anywhere in the project, and detecting that needs the JavaScript parser built in Phase 2. Until then the maximum is `medium`, with `reason` stating that JavaScript was not analyzed. Phase 2 lifts this cap.
- Never report a selector as unused when a dynamic pattern could explain it (spec §1).
- `postcss-selector-parser` is used to extract class and id names from selector strings. A regex misreads attribute selectors and pseudo-classes; the dedicated parser is what PurgeCSS uses. Spec §11 is amended in the same commit as this plan.

---

### Task 1: Project skeleton, ESM toolchain, shared types

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `jest.config.js`
- Create: `src/types.ts`
- Test: `tests/types.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `Confidence`, `Position`, `SelectorDef`, `UsageToken`, `Finding`, `ScanError`, `ScanResult` — imported by every later task.

- [ ] **Step 1: Install dependencies**

```bash
npm install postcss postcss-selector-parser parse5
npm install --save-dev @types/parse5
```

- [ ] **Step 2: Set ESM in package.json**

Add `"type": "module"` immediately after `"private": true`. Replace the `test` script so Jest runs with ESM support:

```json
"test": "NODE_OPTIONS=--experimental-vm-modules jest",
"test:watch": "NODE_OPTIONS=--experimental-vm-modules jest --watch",
"test:coverage": "NODE_OPTIONS=--experimental-vm-modules jest --coverage"
```

- [ ] **Step 3: Switch tsconfig to NodeNext**

In `tsconfig.json` `compilerOptions`, set `"module": "NodeNext"` and `"moduleResolution": "NodeNext"` (replacing `ESNext` and `node`).

- [ ] **Step 4: Replace jest.config.js**

```js
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: { '^.+\\.ts$': ['ts-jest', { useESM: true }] },
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
}
```

- [ ] **Step 5: Write the failing test**

```ts
// tests/types.test.ts
import type { Finding } from '../src/types.js'

test('Finding carries a reason explaining its confidence', () => {
  const f: Finding = {
    type: 'css-selector', name: 'old-header', file: 'a.css',
    line: 1, column: 1, bytes: 42,
    confidence: 'medium', reason: 'JavaScript was not analyzed.',
  }
  expect(f.reason).not.toHaveLength(0)
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- tests/types.test.ts`
Expected: FAIL — cannot find module `../src/types.js`

- [ ] **Step 7: Create src/types.ts**

```ts
export type Confidence = 'high' | 'medium' | 'low'

export interface Position { file: string; line: number; column: number }

export interface SelectorDef extends Position {
  kind: 'class' | 'id' | 'other'
  name: string
  raw: string
  bytes: number
}

export interface UsageToken extends Position {
  value: string
  kind: 'class' | 'id' | 'identifier' | 'dynamic'
}

export interface Finding extends Position {
  type: 'css-selector' | 'js-export'
  name: string
  bytes: number
  confidence: Confidence
  reason: string
}

export interface ScanError { file: string; message: string }

export interface ScanResult {
  summary: {
    filesAnalyzed: number
    unusedCss: number
    unusedJs: number
    estimatedSavings: string
    errors: number
    semanticMode: boolean
  }
  findings: Finding[]
  errors: ScanError[]
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- tests/types.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json jest.config.js src/types.ts tests/types.test.ts
git commit -m "feat: add ESM toolchain and shared scanner types"
```

---

### Task 2: Config loading

**Files:**
- Create: `src/config/types.ts`, `src/config/defaults.ts`, `src/config/load.ts`
- Test: `tests/config/load.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `AssetSweepConfig`, `DEFAULT_CONFIG`, `loadConfig(dir: string): Promise<AssetSweepConfig>`

- [ ] **Step 1: Write the failing test**

```ts
// tests/config/load.test.ts
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from '../../src/config/load.js'
import { DEFAULT_CONFIG } from '../../src/config/defaults.js'

test('returns defaults when no config file exists', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'as-'))
  expect(await loadConfig(dir)).toEqual(DEFAULT_CONFIG)
})

test('.asset-sweeprc.json overrides defaults', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'as-'))
  await writeFile(join(dir, '.asset-sweeprc.json'),
    JSON.stringify({ ignoreClasses: ['js-*'] }))
  const cfg = await loadConfig(dir)
  expect(cfg.ignoreClasses).toEqual(['js-*'])
  expect(cfg.include).toEqual(DEFAULT_CONFIG.include)
})

test('package.json assetSweep key is read', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'as-'))
  await writeFile(join(dir, 'package.json'),
    JSON.stringify({ assetSweep: { safeMode: true } }))
  expect((await loadConfig(dir)).safeMode).toBe(true)
})

test('malformed config rejects rather than silently defaulting', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'as-'))
  await writeFile(join(dir, '.asset-sweeprc.json'), '{ not json')
  await expect(loadConfig(dir)).rejects.toThrow(/\.asset-sweeprc\.json/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/config/load.test.ts`
Expected: FAIL — cannot find module `../../src/config/load.js`

- [ ] **Step 3: Write src/config/types.ts**

```ts
export interface AssetSweepConfig {
  include: string[]
  exclude: string[]
  ignoreSelectors: string[]
  ignoreClasses: string[]
  preserveComments: boolean
  safeMode: boolean
}
```

- [ ] **Step 4: Write src/config/defaults.ts**

```ts
import type { AssetSweepConfig } from './types.js'

export const DEFAULT_CONFIG: AssetSweepConfig = {
  include: ['**/*.{html,js,jsx,ts,tsx,vue,svelte,css}'],
  exclude: ['node_modules/**', 'dist/**'],
  ignoreSelectors: [],
  ignoreClasses: [],
  preserveComments: false,
  safeMode: false,
}
```

- [ ] **Step 5: Write src/config/load.ts**

```ts
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AssetSweepConfig } from './types.js'
import { DEFAULT_CONFIG } from './defaults.js'

async function readJson(path: string): Promise<unknown | undefined> {
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    return undefined          // absent is fine
  }
  try {
    return JSON.parse(raw)    // present but broken is not
  } catch (err) {
    throw new Error(`Could not parse ${path}: ${(err as Error).message}`)
  }
}

export async function loadConfig(dir: string): Promise<AssetSweepConfig> {
  const rc = await readJson(join(dir, '.asset-sweeprc.json'))
  if (rc && typeof rc === 'object') {
    return { ...DEFAULT_CONFIG, ...(rc as Partial<AssetSweepConfig>) }
  }
  const pkg = await readJson(join(dir, 'package.json'))
  const scoped = (pkg as { assetSweep?: Partial<AssetSweepConfig> })?.assetSweep
  if (scoped) return { ...DEFAULT_CONFIG, ...scoped }
  return { ...DEFAULT_CONFIG }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/config/load.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 7: Commit**

```bash
git add src/config tests/config
git commit -m "feat: load config from .asset-sweeprc.json or package.json"
```

---

### Task 3: File discovery

**Files:**
- Create: `src/discover/files.ts`
- Test: `tests/discover/files.test.ts`

**Interfaces:**
- Consumes: `AssetSweepConfig` from Task 2
- Produces: `discoverFiles(dir: string, config: AssetSweepConfig): Promise<string[]>` — absolute paths, sorted, deterministic

- [ ] **Step 1: Write the failing test**

```ts
// tests/discover/files.test.ts
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverFiles } from '../../src/discover/files.js'
import { DEFAULT_CONFIG } from '../../src/config/defaults.js'

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'as-'))
  await writeFile(join(dir, 'a.css'), '.x{}')
  await writeFile(join(dir, 'b.html'), '<div/>')
  await mkdir(join(dir, 'node_modules'), { recursive: true })
  await writeFile(join(dir, 'node_modules', 'c.css'), '.y{}')
  return dir
}

test('finds matching files and excludes node_modules', async () => {
  const dir = await fixture()
  const files = await discoverFiles(dir, DEFAULT_CONFIG)
  const names = files.map(f => f.split('/').pop()).sort()
  expect(names).toEqual(['a.css', 'b.html'])
})

test('returns results in deterministic order', async () => {
  const dir = await fixture()
  expect(await discoverFiles(dir, DEFAULT_CONFIG))
    .toEqual(await discoverFiles(dir, DEFAULT_CONFIG))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/discover/files.test.ts`
Expected: FAIL — cannot find module `../../src/discover/files.js`

- [ ] **Step 3: Write src/discover/files.ts**

```ts
import { glob } from 'glob'
import type { AssetSweepConfig } from '../config/types.js'

export async function discoverFiles(
  dir: string,
  config: AssetSweepConfig,
): Promise<string[]> {
  const matches = await glob(config.include, {
    cwd: dir,
    ignore: config.exclude,
    absolute: true,
    nodir: true,
    dot: false,
  })
  return matches.sort()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/discover/files.test.ts`
Expected: PASS, 2 tests

- [ ] **Step 5: Commit**

```bash
git add src/discover tests/discover
git commit -m "feat: discover project files via include/exclude globs"
```

---

### Task 4: CSS parser

**Files:**
- Create: `src/parse/css.ts`
- Test: `tests/parse/css.test.ts`

**Interfaces:**
- Consumes: `SelectorDef` from Task 1
- Produces: `parseCss(source: string, file: string): SelectorDef[]`

- [ ] **Step 1: Write the failing test**

```ts
// tests/parse/css.test.ts
import { parseCss } from '../../src/parse/css.js'

test('extracts class and id names', () => {
  const defs = parseCss('.header { color: red } #main { color: blue }', 'a.css')
  expect(defs.map(d => [d.kind, d.name])).toEqual([
    ['class', 'header'], ['id', 'main'],
  ])
})

test('extracts from compound and pseudo selectors without confusing parts', () => {
  const defs = parseCss('.btn:hover .icon { color: red }', 'a.css')
  expect(defs.map(d => d.name).sort()).toEqual(['btn', 'icon'])
})

test('does not treat attribute selector values as class names', () => {
  const defs = parseCss('[data-role="btn"] { color: red }', 'a.css')
  expect(defs.map(d => d.name)).not.toContain('btn')
})

test('ignores selectors that appear only inside comments', () => {
  expect(parseCss('/* .ghost { color: red } */', 'a.css')).toHaveLength(0)
})

test('records line numbers and rule byte size', () => {
  const [def] = parseCss('\n\n.late { color: red }', 'a.css')
  expect(def.line).toBe(3)
  expect(def.bytes).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/parse/css.test.ts`
Expected: FAIL — cannot find module `../../src/parse/css.js`

- [ ] **Step 3: Write src/parse/css.ts**

```ts
import postcss from 'postcss'
import selectorParser from 'postcss-selector-parser'
import type { SelectorDef } from '../types.js'

export function parseCss(source: string, file: string): SelectorDef[] {
  const defs: SelectorDef[] = []
  const root = postcss.parse(source, { from: file })

  root.walkRules(rule => {
    const line = rule.source?.start?.line ?? 1
    const column = rule.source?.start?.column ?? 1
    const bytes = rule.toString().length

    selectorParser(sel => {
      sel.walkClasses(node => {
        defs.push({ kind: 'class', name: node.value, raw: rule.selector,
                    file, line, column, bytes })
      })
      sel.walkIds(node => {
        defs.push({ kind: 'id', name: node.value, raw: rule.selector,
                    file, line, column, bytes })
      })
    }).processSync(rule.selector)
  })

  return defs
}
```

Note: postcss discards comment contents from `walkRules`, so the comment test passes without special handling. `walkClasses`/`walkIds` visit only real class and id nodes, so attribute values are never misread.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/parse/css.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/parse/css.ts tests/parse/css.test.ts
git commit -m "feat: parse CSS into selector definitions via postcss"
```

---

### Task 5: HTML parser

**Files:**
- Create: `src/parse/html.ts`
- Test: `tests/parse/html.test.ts`

**Interfaces:**
- Consumes: `UsageToken` from Task 1
- Produces: `parseHtml(source: string, file: string): UsageToken[]`

- [ ] **Step 1: Write the failing test**

```ts
// tests/parse/html.test.ts
import { parseHtml } from '../../src/parse/html.js'

test('extracts class and id usage', () => {
  const tokens = parseHtml('<div class="a b" id="main"></div>', 'i.html')
  expect(tokens.filter(t => t.kind === 'class').map(t => t.value).sort())
    .toEqual(['a', 'b'])
  expect(tokens.filter(t => t.kind === 'id').map(t => t.value)).toEqual(['main'])
})

test('collapses repeated whitespace in class attributes', () => {
  const tokens = parseHtml('<div class="  a   b  "></div>', 'i.html')
  expect(tokens.map(t => t.value).sort()).toEqual(['a', 'b'])
})

test('finds classes on nested elements', () => {
  const tokens = parseHtml('<div class="outer"><p class="inner"></p></div>', 'i.html')
  expect(tokens.map(t => t.value).sort()).toEqual(['inner', 'outer'])
})

test('returns no tokens for markup with no classes or ids', () => {
  expect(parseHtml('<p>hello</p>', 'i.html')).toHaveLength(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/parse/html.test.ts`
Expected: FAIL — cannot find module `../../src/parse/html.js`

- [ ] **Step 3: Write src/parse/html.ts**

```ts
import { parse } from 'parse5'
import type { UsageToken } from '../types.js'

interface Attr { name: string; value: string }
interface Node {
  attrs?: Attr[]
  childNodes?: Node[]
  sourceCodeLocation?: { startLine: number; startCol: number } | null
}

export function parseHtml(source: string, file: string): UsageToken[] {
  const tokens: UsageToken[] = []
  const doc = parse(source, { sourceCodeLocationInfo: true }) as unknown as Node

  const visit = (node: Node): void => {
    const line = node.sourceCodeLocation?.startLine ?? 1
    const column = node.sourceCodeLocation?.startCol ?? 1

    for (const attr of node.attrs ?? []) {
      if (attr.name === 'class') {
        for (const value of attr.value.split(/\s+/).filter(Boolean)) {
          tokens.push({ value, kind: 'class', file, line, column })
        }
      } else if (attr.name === 'id' && attr.value.trim()) {
        tokens.push({ value: attr.value.trim(), kind: 'id', file, line, column })
      }
    }

    for (const child of node.childNodes ?? []) visit(child)
  }

  visit(doc)
  return tokens
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/parse/html.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/parse/html.ts tests/parse/html.test.ts
git commit -m "feat: extract class and id usage from HTML via parse5"
```

---

### Task 6: Safelist matching

**Files:**
- Create: `src/analyze/safelist.ts`
- Test: `tests/analyze/safelist.test.ts`

**Interfaces:**
- Consumes: `SelectorDef` from Task 1, `AssetSweepConfig` from Task 2
- Produces: `isSafelisted(def: SelectorDef, config: AssetSweepConfig): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// tests/analyze/safelist.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/analyze/safelist.test.ts`
Expected: FAIL — cannot find module `../../src/analyze/safelist.js`

- [ ] **Step 3: Write src/analyze/safelist.ts**

```ts
import type { SelectorDef } from '../types.js'
import type { AssetSweepConfig } from '../config/types.js'

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`)
}

export function isSafelisted(
  def: SelectorDef,
  config: AssetSweepConfig,
): boolean {
  if (config.ignoreSelectors.includes(def.raw)) return true
  return config.ignoreClasses.some(p => globToRegExp(p).test(def.name))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/analyze/safelist.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/analyze/safelist.ts tests/analyze/safelist.test.ts
git commit -m "feat: add safelist matching with glob support"
```

---

### Task 7: CSS analysis and confidence scoring

**Files:**
- Create: `src/analyze/confidence.ts`, `src/analyze/css.ts`
- Test: `tests/analyze/css.test.ts`

**Interfaces:**
- Consumes: `SelectorDef`, `UsageToken`, `Finding` (Task 1); `isSafelisted` (Task 6)
- Produces: `scoreCssFinding(): { confidence: Confidence; reason: string }`; `analyzeCss(defs, tokens, config): Finding[]`

- [ ] **Step 1: Write the failing test**

```ts
// tests/analyze/css.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/analyze/css.test.ts`
Expected: FAIL — cannot find module `../../src/analyze/css.js`

- [ ] **Step 3: Write src/analyze/confidence.ts**

```ts
import type { Confidence } from '../types.js'

export const PHASE_1_REASON =
  'No matching class or id found in HTML. JavaScript was not analyzed, ' +
  'so a class applied at runtime would not be detected.'

/**
 * Phase 1 caps confidence at 'medium'. Spec section 7 reserves 'high' for
 * selectors proven absent from a project with no dynamic class construction,
 * and detecting that requires the JavaScript parser built in Phase 2.
 */
export function scoreCssFinding(): { confidence: Confidence; reason: string } {
  return { confidence: 'medium', reason: PHASE_1_REASON }
}
```

- [ ] **Step 4: Write src/analyze/css.ts**

```ts
import type { SelectorDef, UsageToken, Finding } from '../types.js'
import type { AssetSweepConfig } from '../config/types.js'
import { isSafelisted } from './safelist.js'
import { scoreCssFinding } from './confidence.js'

export function analyzeCss(
  defs: SelectorDef[],
  tokens: UsageToken[],
  config: AssetSweepConfig,
): Finding[] {
  const usedClasses = new Set(
    tokens.filter(t => t.kind === 'class').map(t => t.value))
  const usedIds = new Set(
    tokens.filter(t => t.kind === 'id').map(t => t.value))

  const findings: Finding[] = []
  const seen = new Set<string>()

  for (const def of defs) {
    if (isSafelisted(def, config)) continue

    const used = def.kind === 'class' ? usedClasses.has(def.name)
               : def.kind === 'id'    ? usedIds.has(def.name)
               : true                 // 'other' kinds are never reported
    if (used) continue

    const key = `${def.file}:${def.line}:${def.kind}:${def.name}`
    if (seen.has(key)) continue
    seen.add(key)

    const { confidence, reason } = scoreCssFinding()
    findings.push({
      type: 'css-selector', name: def.name, file: def.file,
      line: def.line, column: def.column, bytes: def.bytes,
      confidence, reason,
    })
  }

  return findings
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/analyze/css.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 6: Commit**

```bash
git add src/analyze/confidence.ts src/analyze/css.ts tests/analyze/css.test.ts
git commit -m "feat: determine unused CSS selectors with confidence scoring"
```

---

### Task 8: Text and JSON reports

**Files:**
- Create: `src/report/json.ts`, `src/report/text.ts`
- Test: `tests/report/report.test.ts`

**Interfaces:**
- Consumes: `ScanResult` from Task 1
- Produces: `renderJson(result: ScanResult): string`; `renderText(result: ScanResult): string`

- [ ] **Step 1: Write the failing test**

```ts
// tests/report/report.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/report/report.test.ts`
Expected: FAIL — cannot find module `../../src/report/json.js`

- [ ] **Step 3: Write src/report/json.ts**

```ts
import type { ScanResult } from '../types.js'

export function renderJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2)
}
```

- [ ] **Step 4: Write src/report/text.ts**

```ts
import type { ScanResult, Confidence } from '../types.js'

const ORDER: Confidence[] = ['high', 'medium', 'low']

export function renderText(result: ScanResult): string {
  const { summary, findings, errors } = result
  const lines: string[] = ['Asset Sweep Report', '==================', '']

  lines.push('Summary')
  lines.push(`  Files analyzed:    ${summary.filesAnalyzed}`)
  lines.push(`  Unused CSS rules:  ${summary.unusedCss}`)
  lines.push(`  Estimated savings: ${summary.estimatedSavings}`)
  if (summary.errors > 0) lines.push(`  Files with errors: ${summary.errors}`)
  lines.push('')

  if (findings.length === 0) {
    lines.push('No unused assets found.')
    return lines.join('\n')
  }

  for (const level of ORDER) {
    const group = findings.filter(f => f.confidence === level)
    if (group.length === 0) continue
    lines.push(`${level.toUpperCase()} confidence (${group.length})`)
    for (const f of group) {
      lines.push(`  .${f.name}  ${f.file}:${f.line}  ${f.bytes} bytes`)
    }
    lines.push(`  why: ${group[0].reason}`)
    lines.push('')
  }

  for (const e of errors) lines.push(`  error: ${e.file}: ${e.message}`)
  return lines.join('\n')
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/report/report.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 6: Commit**

```bash
git add src/report tests/report
git commit -m "feat: render scan results as text and JSON"
```

---

### Task 9: Scan orchestration, CLI, and exit codes

**Files:**
- Create: `src/scan.ts`, `src/index.ts`, `src/cli.ts`, `bin/cli.js`
- Modify: `package.json` (restore `bin`, `main`, `types`, `files`)
- Test: `tests/scan.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–8
- Produces: `scan(dir: string, overrides?: Partial<AssetSweepConfig>): Promise<ScanResult>`; CLI exit codes 0/1/2

- [ ] **Step 1: Write the failing test**

```ts
// tests/scan.test.ts
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scan } from '../src/scan.js'

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/scan.test.ts`
Expected: FAIL — cannot find module `../src/scan.js`

- [ ] **Step 3: Write src/scan.ts**

```ts
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import type { ScanResult, SelectorDef, UsageToken, ScanError } from './types.js'
import type { AssetSweepConfig } from './config/types.js'
import { loadConfig } from './config/load.js'
import { discoverFiles } from './discover/files.js'
import { parseCss } from './parse/css.js'
import { parseHtml } from './parse/html.js'
import { analyzeCss } from './analyze/css.js'

function formatBytes(n: number): string {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`
}

export async function scan(
  dir: string,
  overrides: Partial<AssetSweepConfig> = {},
): Promise<ScanResult> {
  const config = { ...(await loadConfig(dir)), ...overrides }
  const files = await discoverFiles(dir, config)

  if (files.length === 0) {
    throw new Error(
      `No files matched in ${dir}. Check the include and exclude patterns.`)
  }

  const defs: SelectorDef[] = []
  const tokens: UsageToken[] = []
  const errors: ScanError[] = []

  for (const file of files) {
    try {
      const source = await readFile(file, 'utf8')
      const ext = extname(file)
      if (ext === '.css') defs.push(...parseCss(source, file))
      else if (ext === '.html') tokens.push(...parseHtml(source, file))
      // Other extensions are discovered but not yet parsed; Phase 2 adds them.
    } catch (err) {
      errors.push({ file, message: (err as Error).message })
    }
  }

  const findings = analyzeCss(defs, tokens, config)
  const savings = findings.reduce((sum, f) => sum + f.bytes, 0)

  return {
    summary: {
      filesAnalyzed: files.length - errors.length,
      unusedCss: findings.length,
      unusedJs: 0,
      estimatedSavings: formatBytes(savings),
      errors: errors.length,
      semanticMode: false,
    },
    findings,
    errors,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/scan.test.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Verify --min-confidence filters rather than being ignored**

Add to `tests/scan.test.ts`:

```ts
import { main } from '../src/cli.js'

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
```

Run: `npm test -- tests/scan.test.ts`
Expected: PASS

- [ ] **Step 6: Write src/index.ts**

```ts
export { scan } from './scan.js'
export { renderText } from './report/text.js'
export { renderJson } from './report/json.js'
export type * from './types.js'
export type { AssetSweepConfig } from './config/types.js'
```

- [ ] **Step 7: Write src/cli.ts**

```ts
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import minimist from 'minimist'
import { scan } from './scan.js'
import { renderText } from './report/text.js'
import { renderJson } from './report/json.js'

export async function main(argv: string[]): Promise<number> {
  const args = minimist(argv, {
    string: ['include', 'exclude', 'report', 'output', 'min-confidence'],
    default: { report: 'text' },
  })
  const [command, target] = args._

  if (command !== 'scan') {
    console.error('Usage: asset-sweep scan <directory> [options]')
    return 2
  }

  const list = (v: unknown): string[] | undefined =>
    typeof v === 'string' ? v.split(',').map(s => s.trim()) : undefined

  try {
    const result = await scan(resolve(target ?? '.'), {
      ...(list(args.include) ? { include: list(args.include)! } : {}),
      ...(list(args.exclude) ? { exclude: list(args.exclude)! } : {}),
    })

    const RANK: Record<string, number> = { low: 0, medium: 1, high: 2 }
    const floor = args['min-confidence']
    if (floor !== undefined) {
      if (!(floor in RANK)) {
        console.error(
          `asset-sweep: --min-confidence must be low, medium, or high`)
        return 2
      }
      result.findings = result.findings.filter(
        f => RANK[f.confidence] >= RANK[floor])
      result.summary.unusedCss = result.findings.filter(
        f => f.type === 'css-selector').length
    }

    const output = args.report === 'json'
      ? renderJson(result) : renderText(result)

    if (args.output) await writeFile(args.output, output, 'utf8')
    else console.log(output)

    const threshold = Number(args.threshold ?? 0)
    const total = result.summary.filesAnalyzed || 1
    const ratio = (result.summary.unusedCss / total) * 100
    return ratio > threshold ? 1 : 0
  } catch (err) {
    console.error(`asset-sweep: ${(err as Error).message}`)
    return 2
  }
}
```

- [ ] **Step 8: Write bin/cli.js**

```js
#!/usr/bin/env node
import { main } from '../dist/cli.js'
main(process.argv.slice(2)).then(code => { process.exitCode = code })
```

- [ ] **Step 9: Restore publish fields in package.json**

Re-add the entries removed while the code did not exist. Keep `"private": true` — it comes off only at the end of Phase 5, on evidence.

```json
"main": "dist/index.js",
"types": "dist/index.d.ts",
"bin": { "asset-sweep": "bin/cli.js" },
"files": ["dist", "bin", "README.md", "LICENSE"]
```

- [ ] **Step 10: Verify the CLI runs end to end**

```bash
npm run build
mkdir -p /tmp/as-demo
printf '.used{color:red}\n.ghost{color:blue}\n' > /tmp/as-demo/s.css
printf '<div class="used"></div>\n' > /tmp/as-demo/i.html
node bin/cli.js scan /tmp/as-demo
echo "exit: $?"
```

Expected: report naming `ghost` at `s.css:2`, MEDIUM confidence, exit `1` (unused ratio exceeds the default threshold of 0).

- [ ] **Step 11: Commit**

```bash
git add src/scan.ts src/index.ts src/cli.ts bin/cli.js package.json tests/scan.test.ts
git commit -m "feat: wire scan orchestration, CLI, and exit codes"
```

---

### Task 10: Fixture integration suite and documentation sync

**Files:**
- Create: `tests/fixtures/basic/{styles.css,index.html,.asset-sweeprc.json}`
- Create: `tests/integration.test.ts`
- Modify: `README.md`, `CHANGELOG.md`

**Interfaces:**
- Consumes: `scan` from Task 9
- Produces: the regression suite guarding the precision guarantee in spec §1

- [ ] **Step 1: Create the fixture project**

`tests/fixtures/basic/styles.css`:

```css
.used { color: red }
.ghost { color: blue }
.js-runtime { color: green }
/* .commented-out { color: black } */
#used-id { color: red }
#ghost-id { color: blue }
```

`tests/fixtures/basic/index.html`:

```html
<div class="used" id="used-id"></div>
```

`tests/fixtures/basic/.asset-sweeprc.json`:

```json
{ "include": ["**/*.{css,html}"], "ignoreClasses": ["js-*"] }
```

- [ ] **Step 2: Write the failing integration test**

```ts
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
```

- [ ] **Step 3: Run test to verify it fails, then passes**

Run: `npm test -- tests/integration.test.ts`
If any assertion fails, fix the implementation — not the test. These four encode the precision guarantee.

- [ ] **Step 4: Run the whole suite and the linter**

```bash
npm test
npm run lint
npm run type-check
```

Expected: all green. Fix anything that is not.

- [ ] **Step 5: Update README to describe real behavior**

In the Project Status section, replace the blanket "the commands below describe the target design, not shipped behavior" with an accurate split: `scan` works for CSS against HTML usage; JavaScript analysis, `.vue`/`.svelte`, and `clean` are not yet implemented. Document `--min-confidence`. State plainly that findings currently cap at medium confidence because JavaScript is not analyzed.

Do not remove the pre-alpha banner and do not touch `"private": true` — both come off at the end of Phase 5, on evidence.

- [ ] **Step 6: Update CHANGELOG**

Under `## [Unreleased]`, add an `### Added` entry recording the CSS scanner, config loading, safelist, text and JSON reports, and the confidence cap.

- [ ] **Step 7: Commit**

```bash
git add tests/fixtures tests/integration.test.ts README.md CHANGELOG.md
git commit -m "test: add fixture integration suite and sync docs to real behavior"
```

---

## Phase 1 Definition of Done

- `npm test`, `npm run lint`, and `npm run type-check` all pass
- `node bin/cli.js scan <dir>` prints a real report and returns 0, 1, or 2 correctly
- No finding is scored `high`
- A selector inside a CSS comment is never reported
- A safelisted class is never reported
- Zero matching files exits 2 rather than reporting a clean project
- README describes what works, not what is planned
