#!/usr/bin/env node
// scripts/benchmark.js
//
// Reproduces, on demand, the fixture shape documented in README.md's
// "Measured Performance" section: N .css files of 50 selectors each, and
// N .html files each using 25 of those 50 selectors — so exactly half of
// all defined selectors are unused. Generates that fixture into a fresh
// temp directory, runs the built scanner (dist/, matching what
// `asset-sweep` actually ships) against it once, prints elapsed time and
// the resulting counts, then deletes the temp directory.
//
// This exists so the numbers in README.md are reproducible by anyone, not
// just something a reader has to trust. It prints measurements only — no
// claims, no adjectives, no comparison to any other tool.
//
// Usage: node scripts/benchmark.js [pairCount]
//   pairCount - number of .css/.html file pairs to generate.
//               Default: 200 (produces 400 files / 10,000 selectors,
//               matching the README's "Fixture A").

import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { scan } from '../dist/scan.js'

const SELECTORS_PER_FILE = 50
const USED_PER_FILE = 25
const DEFAULT_PAIR_COUNT = 200

function parsePairCount(raw) {
  if (raw === undefined) {
    return DEFAULT_PAIR_COUNT
  }
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) {
    console.error(`benchmark: pair count must be a positive integer (got: ${raw})`)
    process.exit(1)
  }
  return n
}

function cssFor(fileIndex) {
  let out = ''
  for (let s = 0; s < SELECTORS_PER_FILE; s++) {
    out += `.sel-${fileIndex}-${s} { color: red; }\n`
  }
  return out
}

function htmlFor(fileIndex) {
  const classes = []
  for (let s = 0; s < USED_PER_FILE; s++) {
    classes.push(`sel-${fileIndex}-${s}`)
  }
  return `<!doctype html><html><body><div class="${classes.join(' ')}"></div></body></html>`
}

async function generateFixture(dir, pairCount) {
  for (let i = 0; i < pairCount; i++) {
    await writeFile(join(dir, `f${i}.css`), cssFor(i))
    await writeFile(join(dir, `f${i}.html`), htmlFor(i))
  }
}

async function main() {
  const pairCount = parsePairCount(process.argv[2])
  const dir = await mkdtemp(join(tmpdir(), 'asset-sweep-bench-'))

  try {
    await generateFixture(dir, pairCount)

    const start = performance.now()
    const result = await scan(dir)
    const elapsedMs = performance.now() - start

    const totalFiles = pairCount * 2
    const { filesAnalyzed, totalCssSelectors, unusedCss } = result.summary
    const usedCss = totalCssSelectors - unusedCss
    const rssMB = process.memoryUsage().rss / 1024 / 1024

    console.log(`pairCount: ${pairCount}`)
    console.log(`files: ${totalFiles}`)
    console.log(`filesAnalyzed: ${filesAnalyzed}`)
    console.log(`selectors: ${totalCssSelectors}`)
    console.log(`used: ${usedCss}`)
    console.log(`unused: ${unusedCss}`)
    console.log(`timeSeconds: ${(elapsedMs / 1000).toFixed(3)}`)
    console.log(`rssMB: ${rssMB.toFixed(1)}`)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

main().catch(err => {
  console.error(`benchmark: ${err.message}`)
  process.exit(1)
})
