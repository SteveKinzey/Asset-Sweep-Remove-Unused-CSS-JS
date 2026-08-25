# Phase 1 Decision Log and Defect Catalog

**Date:** 2026-08-25
**Covers:** building the Asset Sweep CSS scanner from zero source code to merged `main`
**Why this exists:** the working notes that produced these decisions were scratch files
outside version control. The reasoning is worth more than the notes, so it is recorded
here. Where a decision looks arbitrary later, the "cost if wrong" line is the argument
for changing it.

## Part 1 — Defect catalog

Every defect found while building Phase 1. **All are fixed.** They are listed because
the pattern matters more than the individual bugs: *every one was a flaw in the plan or
spec, not an implementation error.* The implementers transcribed faithfully; the
reviews caught what the design got wrong.

### Found during implementation

| # | Defect | Why it mattered |
|---|---|---|
| 1 | `.eslintrc.json` configured `@typescript-eslint/explicit-function-return-types` (plural). No such rule; ESLint treats an unknown rule as a hard error whatever severity it is given. | `npm run lint` failed on every file. Pre-existing scaffolding debt, invisible until the first source file existed. |
| 2 | parse5 option written as `sourceCodeLocations`; the real name is `sourceCodeLocationInfo`. | `sourceCodeLocation` came back undefined, the `?? 1` fallback fired, and **every finding reported line 1** — in a tool whose entire output is file and line. |
| 3 | Default exclude `node_modules/**` only anchors to a direct child of the scanned directory. | Nested vendor directories in any monorepo were scanned, reporting thousands of vendor classes as unused. Fixed to `**/node_modules/**`. |
| 4 | `loadConfig` cast parsed JSON with `as Partial<AssetSweepConfig>` and no runtime validation. | `"ignoreClasses": "foo"` passed the cast and crashed with a raw `TypeError` deep inside the safelist, instead of a clean exit 2. |
| 5 | The two config sources guarded asymmetrically — the rc path tested `typeof === 'object'`, the `package.json` path tested truthiness. | `"assetSweep": "foo"` reached the validator and threw `TypeError: Cannot use 'in' operator`. A bug inside the fix for #4. |
| 6 | `renderText` printed one `why:` line per confidence group, taken from `group[0].reason`. | Once findings in a group carry different reasons, every finding is labelled with the first one's explanation. Invisible in Phase 1 because all reasons were identical. |
| 7 | Threshold ratio was `(unusedCss / filesAnalyzed) * 100` — unused *selectors* divided by *files*. | Not a percentage of anything. Adding JavaScript files grew the denominator, diluting the ratio until **CI silently went green**. |
| 8 | Findings printed absolute paths. | Machine-specific prefixes made JSON reports non-reproducible across machines, breaking diffing in CI. |
| 9 | `--min-confidence` was declared as a CLI option and never used to filter. | The flag parsed cleanly and did nothing. Caught by the plan's own self-review before implementation. |

### Found by the final whole-branch review

| # | Defect | Why it mattered |
|---|---|---|
| 10 | `walkClasses` descended into `:not()`, `:is()`, `:where()`, `:has()` arguments. | `.a:not(.b)` reported `.b` as unused. A negation guard is not a definition, and the reported location was the rule `.a` depends on. |
| 11 | When an HTML file failed to parse its usage tokens were lost, but `analyzeCss` still asserted. | A used class was reported unused at `medium` with the reason *"No matching class or id found in HTML"* — a statement that is false, since the HTML was never read. The tool stated a falsehood with confidence. |
| 12 | parse5 places `<template>` contents under `node.content`, not `childNodes`. | Classes used inside templates were invisible and reported unused. Plain valid HTML — web components, Alpine, HTMX. |
| 13 | `Number('abc')` is `NaN`, and `ratio > NaN` is always false. | A typo'd `--threshold` **permanently disabled the CI gate**. |
| 14 | `ignoreSelectors` was exact-match while the README promised globs. | The documented escape hatch from false positives was inert. |

### Found by adversarial probing after the review passed

| # | Defect | Why it mattered |
|---|---|---|
| 15 | parse5 defaults to `scriptingEnabled: true`, parsing `<noscript>` contents as raw text. | Classes used only inside `<noscript>` were reported unused. `<noscript>` renders whenever JS is off. |
| 16 | Inline `<style>` blocks were never scanned for definitions. | An entire category of dead CSS was invisible to the scanner. |
| 17 | Making `ignoreSelectors` glob unanchored (the fix for #14). | `{"ignoreSelectors": ["a"]}` silently safelisted `.alpha` and `.beta`. Turned the escape hatch into a false-negative generator. Caught only by probing with a deliberately hostile one-character pattern. |
| 18 | `--min-confidence medium` filtered away the `low` findings produced by #11's downgrade. | Exit 0 on an incomplete scan. CI reads exit codes, not stdout — the gate went green precisely when the scan was least trustworthy. |
| 19 | `bytes` assigned `rule.toString().length` per selector node. | A 43-byte rule with two selectors reported `86 B` of savings. UTF-16 code units, not bytes, so non-ASCII was wrong twice. |
| 20 | `.htm` and `.xhtml` were in neither the include glob nor the extension switch. | A `.htm` project had **no usage read at all**, so every selector was reported unused — a total false-positive wipeout. |
| 21 | tsconfig `types: ["node", "jest"]` with `include: ["src"]`. | `expect` and `test` were ambient inside production source; a typo referencing them would compile. |
| 22 | `npm run benchmark` pointed at `scripts/benchmark.js`, which never existed; `chalk` was a declared dependency with zero imports. | Broken promise in `package.json`; unused dependency weight. |

### The pattern worth remembering

Defects **2, 3, 6, 7** were invisible to their own passing tests:

- #2 — no test asserted a line number
- #3 — the fixture had only a top-level `node_modules`
- #6 — the test data had one finding per group
- #7 — exit codes happened to agree on the sampled fixture

Each test asserted something *adjacent to* the property that mattered. That is why the
suite now asserts positions on a non-line-1 element, builds a nested vendor directory,
uses multiple findings with differing reasons, and pins the threshold contract with
randomized ratios.

## Part 2 — Decisions taken without asking

Recorded with what each costs if it turns out wrong.

**Toolchain**

1. **Kept `NODE_OPTIONS=... jest` inline-env test scripts** despite the CI matrix
   including Windows, where that syntax is invalid. CI is `workflow_dispatch`-only.
   *Cost if wrong:* Windows contributors hit a confusing failure before Phase 5.
2. **Accepted `isolatedModules: true`** — ts-jest warns without it under NodeNext.
   *Cost if wrong:* forbids `const enum` and untyped re-export, both avoidable.
3. **Accepted `"jest"` in tsconfig `types`** — without it no test file compiles. Later
   corrected by a separate `tsconfig.test.json` (defect 21).
4. **Pinned every review range to explicit SHAs** while concurrent agents were live,
   after finding the tree carrying uncommitted work from another agent mid-review.
   *Cost if wrong:* none; strictly safer than `HEAD`-relative.

**Correctness**

5. **Config validation is load-bearing, not deferrable** (defect 4). The spec requires
   malformed config to exit 2; an unhandled `TypeError` is not that.
6. **`present-but-null` rc file throws rather than falling through.** A file containing
   `null` is present and malformed. *Cost if wrong:* someone using `null` to mean "no
   config" gets an error; deleting the file is the remedy.
7. **Relativize paths against `process.cwd()`, not the scan root.** Scan-root-relative
   prints `styles.css` for `src/styles.css` when running `scan ./src` from a repo root
   — a path that does not resolve from where the user stands. *This was corrected
   mid-flight after being specified wrongly.*
8. **Threshold became unused selectors over total selectors** (defect 7). *Cost if
   wrong:* threshold values now mean something different from before — acceptable,
   since before they meant nothing coherent.
9. **A scan that cannot read a usage source never exits 0** (defect 18). *Cost if
   wrong:* a user cannot distinguish "threshold exceeded" from "scan incomplete" by
   exit code alone; the report and JSON both say which.
10. **A failed `.css` file does NOT trigger the usage-source downgrade.** Losing
    definitions cannot create a false positive; losing usage can.
11. **`:is()`/`:where()` arguments are definitions; `:not()`/`:has()` arguments are
    guards.** `:is(.a, .b) > .t` is exactly `.a > .t, .b > .t`. *Cost if wrong:* an
    exotic selector shape breaks the model. Nothing has, across 200 generative cases.
12. **Where uncertain, err toward emitting a finding.** A false positive is loud and
    the user can safelist it; a false negative is silent and undiscoverable.
13. **Anchored `ignoreSelectors` globs** (defect 17), sharing one helper with
    `ignoreClasses` so the two cannot drift apart again.
14. **Deduplicate savings by rule identity, count true UTF-8 bytes** (defect 19).

**Process**

15. **Batched Tasks 3–6 into one dispatch** — four standalone pure functions in
    disjoint files. *Cost if wrong:* one review surface for four modules dilutes
    attention; mitigated by requiring a per-module verdict.
16. **Built `scripts/benchmark.js` rather than deleting the dead script entry.** The
    README now carries measured numbers; a script reproducing them makes the claim
    verifiable. This repository previously carried fabricated benchmarks.
17. **Removed `chalk` rather than adding colour output to justify it.**
18. **Committed the torture fixture as real checked-in files**, not generated at test
    time — reviewable in a diff. Its `node_modules` fixture had to be force-added past
    the repo's own gitignore, or the test would pass locally and fail on a clean clone.
19. **Generative tests added and verified by mutation.** An `analyzeCss` that ignores
    its input and returns the torture fixture's expected answer passes **28 of 28**
    example-based assertions and fails the generative tests immediately.

## Part 3 — Errors I made and corrected

Recorded because the correction is the useful part.

- **Relativized against the scan root instead of `process.cwd()`** (decision 7). The
  test I specified — "path does not start with `/`" — would have passed under both, so
  it was strengthened to a round-trip assertion.
- **Scoped the documentation sync to a nine-item grep instead of a full read.** Got back
  exactly nine fixes and left `clean` documented as usable in four other sections. Cost
  a Critical finding. The remedy was a full audit of README and ABOUT, which corrected
  21 passages.
- **Wrote a verification whose expected value was wrong** — asserted 11 bytes for
  `.é-uni{c:d}` by counting characters. The correct answer is 12; the scanner was
  right. The check made exactly the mistake it was testing for.
- **Committed a spec change before running its consistency check**, which then found
  three contradictions I had just introduced.
- **Wrote a commit message containing backticks in a shell heredoc that expanded them**,
  silently eating two words from the rationale. Caught by reading back what actually
  committed.

Pattern: every one surfaced only because the check was *run* rather than reasoned about.
