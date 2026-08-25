// tests/torture.test.ts
//
// This fixture (tests/fixtures/torture/) exercises every CSS detection path
// and every false-positive trap found while building the Phase 1 scanner,
// in one place. Each MUST-NOT-BE-FLAGGED case below corresponds to a real
// defect that was found and fixed during development — not a hypothetical.
// Do not "simplify" this file by trimming cases that look redundant; a
// case that looks obvious is usually the one that once broke silently.
//
// Notable defects, named because the fix is not obvious from the name alone:
//   - used-in-template / used-in-nested-template: parse5 puts the contents
//     of a <template> element under a special `content` document fragment,
//     not under `childNodes` like every other element. A walker that only
//     recurses into `childNodes` silently skips everything inside <template>,
//     including nested <template> elements.
//   - not-arg / has-arg: the arguments of guard pseudo-classes like
//     `:not(...)` and `:has(...)` were being treated as selector
//     *definitions* in their own right, so `.guard:not(.not-arg)` incorrectly
//     produced a spurious "definition" of `.not-arg`.
//   - comment-only: a selector that appears only inside a CSS comment
//     (`/* .comment-only { ... } */`) must never be treated as a real rule.
//     postcss's comment nodes need to be excluded, not just skipped by
//     accident of parsing order.
//   - vendor-noise: the default exclude glob only matched a `node_modules`
//     directory sitting directly under the scanned root; a `node_modules`
//     nested inside another directory (packages/vendor/node_modules) was
//     not excluded until the glob got a `**/` prefix.
//   - deep-scoped: `ignoreSelectors` was originally a plain string-equality
//     check (no globbing at all), then a naive glob that matched
//     unanchored (as a substring), which could silently swallow unrelated
//     selectors. It must be an anchored glob against the full raw selector.
//
// Caveat: this is a regression net, not a proof of correctness. A scan()
// that returned a hardcoded constant matching this fixture's expected
// output would pass every assertion here. It catches known defects from
// regressing; it does not prove the scanner is correct on inputs it has
// never seen.

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { scan } from '../src/scan.js'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = join(here, 'fixtures', 'torture')

const MUST_BE_FLAGGED = [
  'unused-class',
  'unused-id',
  'unused-a',
  'unused-b',
  'unused-attr',
  'unused-is1',
  'unused-is2',
  'unused-is3',
  'unused-where',
  'unused-where2',
  'unused-in-media',
  'unused-in-supports',
]

const MUST_NOT_BE_FLAGGED = [
  'used-class',
  'used-id',
  'used-in-template',
  'used-in-nested-template',
  'used-multi',
  'used-spaced',
  'js-safelisted',
  'deep-scoped',
  'guard',
  'host',
  'not-arg',
  'has-arg',
  'comment-only',
  'vendor-noise',
  'broken-rule',
]

describe('torture fixture: every detection path and every false-positive trap', () => {
  test.each(MUST_BE_FLAGGED)('MUST be flagged: %s', async name => {
    const { findings } = await scan(fixture)
    expect(findings.map(f => f.name)).toContain(name)
  })

  test.each(MUST_NOT_BE_FLAGGED)('must NOT be flagged: %s', async name => {
    const { findings } = await scan(fixture)
    expect(findings.map(f => f.name)).not.toContain(name)
  })

  test('no unexpected extras: reported names equal exactly the must-flag list', async () => {
    const { findings } = await scan(fixture)
    const names = findings.map(f => f.name).sort()
    expect(names).toEqual([...MUST_BE_FLAGGED].sort())
  })
})
