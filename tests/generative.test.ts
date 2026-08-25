// tests/generative.test.ts
//
// Every other test in this suite is example-based: one fixture, one
// expected result. That means a scan() that ignored its input entirely
// and returned a hardcoded constant matching each fixture would pass all
// of them (see the header of tests/torture.test.ts, which says so
// honestly). This file closes that gap: it generates hundreds of random
// projects where the correct answer is known BY CONSTRUCTION — no
// constant can be built to satisfy hundreds of distinct randomized cases.
//
// Determinism: no Math.random(). Every case is derived from an integer
// seed via a tiny inline PRNG (mulberry32), so any failure is
// reproducible: rerun with the same seed to get byte-identical CSS/HTML.
// A flaky, unreproducible test is worse than no test, so seed/css/html
// are always included in failure messages below.

import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { jest } from '@jest/globals'
import { scan } from '../src/scan.js'
import { main } from '../src/cli.js'

// ---------------------------------------------------------------------
// Seeded PRNG (mulberry32) and small helpers built on it. Deliberately
// hand-rolled per the task constraints — no external generative-testing
// library.
// ---------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed
  return function next(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

function randChar(rng: () => number, chars: string): string {
  return chars[randInt(rng, 0, chars.length - 1)]
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[randInt(rng, 0, arr.length - 1)]
}

function shuffle<T>(rng: () => number, arr: readonly T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i)
    const tmp = a[i]
    a[i] = a[j]
    a[j] = tmp
  }
  return a
}

// ---------------------------------------------------------------------
// Name generation: lowercase letters, digits, hyphens only; always starts
// with a letter (or a caller-supplied prefix); unique within one case via
// the shared `used` set passed in.
// ---------------------------------------------------------------------

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'
const ALNUM = LETTERS + '0123456789'

function randomName(rng: () => number, prefix: string): string {
  let s = prefix.length > 0 ? prefix : randChar(rng, LETTERS)
  const suffixLen = randInt(rng, 3, 8)
  const targetLen = s.length + suffixLen
  while (s.length < targetLen) {
    const pool = ALNUM + '-'
    let c = randChar(rng, pool)
    // never produce a trailing hyphen or a double hyphen: not required
    // for correctness, just keeps generated names easy to eyeball in a
    // failure dump.
    if (c === '-' && (s.endsWith('-') || s.length === targetLen - 1)) {
      c = randChar(rng, ALNUM)
    }
    s += c
  }
  return s
}

function uniqueName(rng: () => number, used: Set<string>, prefix = ''): string {
  let name = randomName(rng, prefix)
  while (used.has(name)) {
    name = randomName(rng, prefix)
  }
  used.add(name)
  return name
}

// ---------------------------------------------------------------------
// Property 1: scan() reports exactly the unused set, across a wide mix
// of real feature surface (media/supports nesting, inline <style>,
// template/noscript usage, irregular whitespace, class/id namespace
// collisions, safelisting, and :not()/:has() guards vs :is()/:where()
// definitions).
// ---------------------------------------------------------------------

type Placement = 'plain' | 'media' | 'supports' | 'inline'
type Wrap = 'none' | 'is' | 'where'

interface DefSpec {
  name: string
  kind: 'class' | 'id'
  used: boolean
  placement: Placement
  wrap: Wrap
}

interface GeneratedCase {
  seed: number
  css: string
  html: string
  ignoreClasses: string[]
  expectedUnusedClasses: string[]
  expectedUnusedIds: string[]
}

const PLACEMENTS: readonly Placement[] = ['plain', 'media', 'supports', 'inline']
// Biased toward 'none' so most rules are plain selectors, same as a real
// stylesheet, while still exercising :is()/:where() regularly.
const WRAPS: readonly Wrap[] = ['none', 'none', 'none', 'is', 'where']
const WS_VARIANTS: readonly string[] = [' ', '  ', '\t', ' \t ', '\n  ', '\n\t']

function irregularJoin(rng: () => number, names: readonly string[]): string {
  return names.map((n, i) => (i === 0 ? n : `${pick(rng, WS_VARIANTS)}${n}`)).join('')
}

function renderUsageHtml(
  rng: () => number,
  classNames: readonly string[],
  idNames: readonly string[],
): string {
  const units: string[] = []

  // Group used classes into small clusters sharing one class attribute
  // (irregular whitespace, multiple classes in one attribute).
  const shuffledClasses = shuffle(rng, classNames)
  let i = 0
  while (i < shuffledClasses.length) {
    const groupSize = Math.min(randInt(rng, 1, 3), shuffledClasses.length - i)
    const group = shuffledClasses.slice(i, i + groupSize)
    i += groupSize
    units.push(`<div class="${irregularJoin(rng, group)}"></div>`)
  }

  for (const idName of idNames) {
    units.push(`<div id="${idName}"></div>`)
  }

  const bodyUnits: string[] = []
  const templateUnits: string[] = []
  const noscriptUnits: string[] = []
  for (const unit of shuffle(rng, units)) {
    const bucket = rng()
    if (bucket < 0.34) {
      templateUnits.push(unit)
    } else if (bucket < 0.5) {
      noscriptUnits.push(unit)
    } else {
      bodyUnits.push(unit)
    }
  }

  return (
    '<body>' +
    bodyUnits.join('') +
    `<template>${templateUnits.join('')}</template>` +
    `<noscript>${noscriptUnits.join('')}</noscript>` +
    '</body>'
  )
}

function generateCase(seed: number): GeneratedCase {
  const rng = mulberry32(seed)
  const allNames = new Set<string>()

  const defs: DefSpec[] = []

  // Core pool: independently random kind (class/id) and used-flag. This
  // is the heart of the property — the correct answer is known because
  // WE chose used/unused when generating, not because of any fixture.
  const mainCount = randInt(rng, 5, 14)
  for (let n = 0; n < mainCount; n++) {
    defs.push({
      name: uniqueName(rng, allNames),
      kind: rng() < 0.5 ? 'class' : 'id',
      used: rng() < 0.5,
      placement: pick(rng, PLACEMENTS),
      wrap: pick(rng, WRAPS),
    })
  }

  // Same-name collisions: one base name defined as BOTH a class and an
  // id, with INDEPENDENTLY random used-flags per namespace. A scanner
  // that let a used id "foo" mark class "foo" as used too (or vice
  // versa) is a real bug class already found in this project.
  const collisionCount = randInt(rng, 0, 3)
  for (let n = 0; n < collisionCount; n++) {
    const name = uniqueName(rng, allNames)
    defs.push({
      name, kind: 'class', used: rng() < 0.5,
      placement: pick(rng, PLACEMENTS), wrap: pick(rng, WRAPS),
    })
    defs.push({
      name, kind: 'id', used: rng() < 0.5,
      placement: pick(rng, PLACEMENTS), wrap: pick(rng, WRAPS),
    })
  }

  // Safelisted names: always unused, always covered by a generated
  // ignoreClasses glob built from the SAME reserved prefix, so we know
  // by construction which names the glob covers. These must never
  // appear in findings even though they are unused.
  const safelistCount = randInt(rng, 0, 3)
  const safelistPrefix = `zzsafe${randInt(rng, 1000, 9999)}-`
  const safelistNames: string[] = []
  for (let n = 0; n < safelistCount; n++) {
    const name = uniqueName(rng, allNames, safelistPrefix)
    safelistNames.push(name)
    defs.push({ name, kind: 'class', used: false, placement: 'plain', wrap: 'none' })
  }
  const ignoreClasses = safelistCount > 0 ? [`${safelistPrefix}*`] : []

  // Guards: a name that appears ONLY as an argument to :not()/:has() on
  // some other (real) definition's selector. It is never a definition
  // itself, so it must never appear in findings — used or unused. Picked
  // from defs with wrap 'none' so the guard syntax stays simple:
  // `.host:not(.guardname) { ... }`.
  const guardCount = randInt(rng, 0, 2)
  const hostCandidates = defs.filter(d => d.wrap === 'none')
  const guardByIndex = new Map<number, { name: string; pseudo: 'not' | 'has' }>()
  for (let n = 0; n < guardCount && hostCandidates.length > 0; n++) {
    const host = pick(rng, hostCandidates)
    const hostIndex = defs.indexOf(host)
    if (!guardByIndex.has(hostIndex)) {
      guardByIndex.set(hostIndex, {
        name: uniqueName(rng, allNames, 'guard'),
        pseudo: rng() < 0.5 ? 'not' : 'has',
      })
    }
  }

  // Emit CSS (and collect inline-<style> rules separately).
  const cssParts: string[] = []
  const inlineParts: string[] = []
  defs.forEach((def, idx) => {
    const bareSel = def.kind === 'class' ? `.${def.name}` : `#${def.name}`
    const wrappedSel = def.wrap === 'none' ? bareSel : `:${def.wrap}(${bareSel})`
    const guard = guardByIndex.get(idx)
    const finalSel = guard ? `${bareSel}:${guard.pseudo}(.${guard.name})` : wrappedSel
    const rule = `${finalSel} { color: red; padding: 1px; }`

    if (def.placement === 'inline') {
      inlineParts.push(rule)
    } else if (def.placement === 'media') {
      cssParts.push(`@media (min-width: 10px) {\n${rule}\n}`)
    } else if (def.placement === 'supports') {
      cssParts.push(`@supports (display: flex) {\n${rule}\n}`)
    } else {
      cssParts.push(rule)
    }
  })

  const usedClassNames = defs.filter(d => d.kind === 'class' && d.used).map(d => d.name)
  const usedIdNames = defs.filter(d => d.kind === 'id' && d.used).map(d => d.name)

  const styleBlock = inlineParts.length > 0 ? `<style>\n${inlineParts.join('\n')}\n</style>` : ''
  const bodyHtml = renderUsageHtml(rng, usedClassNames, usedIdNames)
  const html = `<!doctype html>\n<html><head>${styleBlock}</head>${bodyHtml}</html>`

  const expectedUnusedClasses = defs
    .filter(d => d.kind === 'class' && !d.used)
    .map(d => d.name)
    .filter(name => !safelistNames.includes(name))
  const expectedUnusedIds = defs
    .filter(d => d.kind === 'id' && !d.used)
    .map(d => d.name)

  return {
    seed,
    css: cssParts.join('\n\n'),
    html,
    ignoreClasses,
    expectedUnusedClasses,
    expectedUnusedIds,
  }
}

function debugDump(kase: GeneratedCase): string {
  return (
    `\n--- seed: ${kase.seed} ---\n` +
    `--- generated CSS (styles.css) ---\n${kase.css}\n` +
    `--- generated HTML (index.html) ---\n${kase.html}\n` +
    `--- .asset-sweeprc.json ---\n${JSON.stringify({ ignoreClasses: kase.ignoreClasses })}\n`
  )
}

function assertNoMissing(
  label: string, kase: GeneratedCase, expected: string[], actual: string[],
): void {
  const missing = expected.filter(name => !actual.includes(name))
  if (missing.length > 0) {
    throw new Error(
      `${label}: ${missing.length} name(s) were expected to be reported unused ` +
      `but were NOT found in scan() findings: ${JSON.stringify(missing)}` +
      debugDump(kase),
    )
  }
}

function assertNoExtra(
  label: string, kase: GeneratedCase, expected: string[], actual: string[],
): void {
  const extra = actual.filter(name => !expected.includes(name))
  if (extra.length > 0) {
    throw new Error(
      `${label}: ${extra.length} name(s) were reported unused but should NOT ` +
      `have been (used, safelisted, or a guard argument): ${JSON.stringify(extra)}` +
      debugDump(kase),
    )
  }
}

describe('generative: scan() reports exactly the unused set (property-based)', () => {
  // Keeps the suite well under the ~10s budget while still exercising
  // hundreds of distinct randomized projects (measured ~a few seconds
  // locally for 200 iterations of small 5-25-selector projects).
  const ITERATIONS = 200
  const BASE_SEED = 20260825

  test(`holds across ${ITERATIONS} randomly generated projects`, async () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const kase = generateCase(BASE_SEED + i)
      const dir = await mkdtemp(join(tmpdir(), 'as-gen-'))
      try {
        await writeFile(join(dir, 'styles.css'), kase.css, 'utf8')
        await writeFile(join(dir, 'index.html'), kase.html, 'utf8')
        await writeFile(
          join(dir, '.asset-sweeprc.json'),
          JSON.stringify({ ignoreClasses: kase.ignoreClasses }),
          'utf8',
        )

        const result = await scan(dir)
        const actualClasses = result.findings
          .filter(f => f.selectorKind === 'class')
          .map(f => f.name)
        const actualIds = result.findings
          .filter(f => f.selectorKind === 'id')
          .map(f => f.name)

        // Both directions asserted separately, so a failure says WHICH
        // happened (a miss vs. an extra) rather than just "not equal".
        assertNoMissing('class', kase, kase.expectedUnusedClasses, actualClasses)
        assertNoExtra('class', kase, kase.expectedUnusedClasses, actualClasses)
        assertNoMissing('id', kase, kase.expectedUnusedIds, actualIds)
        assertNoExtra('id', kase, kase.expectedUnusedIds, actualIds)
      } finally {
        await rm(dir, { recursive: true, force: true })
      }
    }
  })
})

// ---------------------------------------------------------------------
// Property 2: the --threshold gate's exit code follows the actual
// unused/total ratio for arbitrary randomized ratios, not just the
// handful of hand-picked percentages covered elsewhere.
// ---------------------------------------------------------------------

describe('generative: --threshold exit code matches an arbitrary randomized ratio', () => {
  const ITERATIONS = 40
  const BASE_SEED = 842026

  test(`exit 1 below the ratio and exit 0 at/above it, across ${ITERATIONS} randomized ratios`, async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    try {
      for (let i = 0; i < ITERATIONS; i++) {
        const rng = mulberry32(BASE_SEED + i)
        const total = randInt(rng, 1, 40)
        const unused = randInt(rng, 0, total)
        const usedCount = total - unused
        const ratio = (unused / total) * 100 // known by construction

        const cssLines: string[] = []
        const htmlDivs: string[] = []
        for (let n = 0; n < total; n++) {
          cssLines.push(`.sel${n} { color: red }`)
          if (n < usedCount) {
            htmlDivs.push(`<div class="sel${n}"></div>`)
          }
        }

        const dir = await mkdtemp(join(tmpdir(), 'as-ratio-'))
        try {
          await writeFile(join(dir, 'styles.css'), cssLines.join('\n'), 'utf8')
          await writeFile(
            join(dir, 'index.html'),
            `<html><body>${htmlDivs.join('')}</body></html>`,
            'utf8',
          )

          if (unused > 0) {
            const margin = randInt(rng, 1, 5)
            const belowThreshold = Math.max(0, Math.floor(ratio) - margin)
            const codeBelow = await main(['scan', dir, '--threshold', String(belowThreshold)])
            if (codeBelow !== 1) {
              throw new Error(
                `seed=${BASE_SEED + i} total=${total} unused=${unused} ratio=${ratio} ` +
                `threshold=${belowThreshold}: expected exit 1 (threshold below ratio), got ${codeBelow}`,
              )
            }
          }

          const margin2 = randInt(rng, 1, 5)
          const aboveThreshold = Math.min(100, Math.ceil(ratio) + margin2)
          const codeAbove = await main(['scan', dir, '--threshold', String(aboveThreshold)])
          if (codeAbove !== 0) {
            throw new Error(
              `seed=${BASE_SEED + i} total=${total} unused=${unused} ratio=${ratio} ` +
              `threshold=${aboveThreshold}: expected exit 0 (threshold at/above ratio), got ${codeAbove}`,
            )
          }
        } finally {
          await rm(dir, { recursive: true, force: true })
        }
      }
    } finally {
      logSpy.mockRestore()
    }
  })
})
