# Asset Sweep Phase 2 — JavaScript Dead-Export Analysis

**Date:** 2026-08-25
**Status:** Approved, not yet implemented
**Builds on:** `2026-08-25-asset-sweep-scanner-design.md` (Phase 1, shipped and merged)

## 1. Problem

Phase 1 finds unused CSS selectors. Phase 2 adds unused JavaScript exports, and
uses the JavaScript it now parses to make the CSS half substantially more accurate.

The governing rule is unchanged: **when the analyzer cannot prove something is
unreferenced, it must say so rather than assert it.** A future `clean` deletes what
this reports.

## 2. Scope

In scope:

- Dead-export detection for `.js` `.jsx` `.ts` `.tsx`
- Module graph with real specifier resolution
- Entry-point discovery
- Dynamic class construction detection, **scoped by reach**, lifting the CSS cap
- CSS Modules support
- Literal class strings in JavaScript counted as CSS usage
- TypeScript semantic upgrade when the target has a usable tsconfig

Explicitly out of scope, and to be **stated in the docs rather than left silent**:

- **CommonJS.** `module.exports` and `require()` produce no ESM export records, so a
  CJS project would report zero dead exports and look clean. That is a silent false
  negative — the worst kind. Until CJS is supported, the scanner must DETECT that a
  file uses CJS module syntax and warn that the file was not analyzed for exports.
  Silence is not acceptable; a wrong "all clear" is worse than a stated gap.
- **Type-only exports.** `export type Foo` that nothing imports is genuinely dead,
  but removing it has zero runtime effect, and `import type` resolves differently
  from a value import. Tracking them and reporting them mixed in with runtime
  exports would mislead a user cleaning dead code. Deferred to its own decision.
- Unused-file (orphaned module) detection. A separate analysis with its own
  false-positive profile.
- The `clean` command.

## 3. What makes an export dead

An export is a candidate when ALL hold:

1. No file in the project imports that name from that module.
2. It is not re-exported from a module that is itself reachable.
3. Its own file is not an entry point. **Every export of an entry file is public API
   and is never reported.**

Entry points come from the target's `package.json` — `main`, `module`, `exports`,
`bin` — plus a configurable `entries` glob in `.asset-sweeprc.json`. When neither
yields a root, the scan reports that no entry points were found and treats every
export as reachable rather than reporting the entire project as dead. The practical
consequence must be stated in the report, not merely implied: with no roots, ZERO dead
exports are reported, and the user is told that configuring `entries` is what enables
the analysis. A silent empty result would read as "your code is clean".

### Barrel-file annotation

`export * from './utils'` inside an entry makes every export of `utils` public API.
Barrel files are common, so on a barrel-heavy codebase almost nothing is dead — which
is correct, and unhelpful without explanation.

This cannot be a field on `Finding`: a finding is by definition something reported as
dead, and these modules are alive. It is a SEPARATE report section — "reachable only
via star re-export" — listing modules kept alive solely by a barrel. They are not dead,
but they are often *accidentally* public, and that distinction is what the user needs.
`ScanResult` gains `starReexportOnly: string[]` for it.

## 4. Module resolution

Resolution order for each import specifier:

| Specifier | Resolution |
|---|---|
| bare, not matching an alias | external dependency — ignored, not an error |
| matches a tsconfig `paths` alias | mapped candidates, tried in order |
| `'./x.js'` | `x.ts`, `x.tsx` first (NodeNext convention), then `x.js` |
| `'./x'` | `x.{ts,tsx,js,jsx,mjs,cjs}`, then `x/index.{…}` |
| unresolved | recorded; affected findings downgraded; the reason names the specifier |

An unresolved specifier must never be silently treated as "not an import". That would
turn a resolution gap into a false positive, which is the same failure Phase 1 fixed
for unreadable usage files.

`ScanResult.summary.unresolvedImports` carries the count.

## 5. Dynamic class construction, scoped by reach

Phase 1 caps CSS findings at `medium` because it cannot see dynamic class
construction. Phase 2 lifts that — but a project-wide boolean would be useless.
`clsx`, `classnames`, or a single `` `btn-${size}` `` appears in nearly every modern
codebase, so a blanket flag would leave every finding at `medium` forever and deliver
nothing.

Signals are therefore classified by what they can actually produce:

| Signal | Reach | Effect |
|---|---|---|
| `` `btn-${x}` `` | classes matching `^btn-` | those classes -> `low`; all others unaffected |
| `` `${x}-btn` `` | classes matching `-btn$` | those classes -> `low`; all others unaffected |
| `` `${a}${b}` `` — no static part | unbounded | **opaque** |
| `classList.add(v)`, `v` not a literal | unbounded | **opaque** |
| `clsx(v)`, `v` not a literal | unbounded | **opaque** |
| `classList.add('foo')` — literal | none | this is a **usage** of `.foo`, not a dynamic signal |

Resulting CSS confidence:

- **No signals at all** -> findings may be `high`.
- **Only scoped signals** -> `high`, except classes matching a signal's pattern, which
  are `low` and whose reason names the constructing site.
- **Any opaque signal** -> all CSS findings cap at `medium`, and the reason names the
  opaque site's file and line so the user can inspect or safelist it.

An opaque signal genuinely means no class can be ruled out. Capping at `medium`
rather than `low` reflects that this is uncertainty, not evidence of use.

**Precedence when both apply.** A class may match a scoped signal's pattern while an
opaque signal also exists elsewhere. The lower level wins: the class is `low`. A scoped
pattern match is specific evidence that this particular class may be constructed, which
is stronger than the general uncertainty an opaque signal creates.

## 6. CSS Modules

`import s from './Button.module.css'` followed by `s.wrapper` is the dominant pattern
in React and Next.js codebases. Phase 1 reports every CSS Module class as unused,
because nothing in the HTML references them. On such a project that is most of the
CSS — an entire category of wrong answers.

Phase 2 resolves default imports of files matching `*.module.css` and treats member
access on the imported binding — `s.wrapper`, `s['wrapper']`, `s?.wrapper` — as usage.

**Usage from a CSS Module import is SCOPED to that stylesheet.** `s.wrapper` in one
component must not mark `.wrapper` used in a different `.module.css`. `UsageToken`
therefore gains an optional `scope` field naming the stylesheet it applies to;
unscoped tokens continue to apply globally as today.

Computed access with a non-literal key — `s[dynamicName]` — is an opaque signal for
that stylesheet, capping its findings at `medium`.

## 7. JavaScript as a usage source

Once JavaScript is parsed, literal class strings in `classList.add('foo')`,
`clsx('bar')`, and `className = 'baz'` are real CSS usage that Phase 1 could not see.
Some existing CSS findings will correctly disappear.

The consequence: **`.js`/`.jsx`/`.ts`/`.tsx` files become usage sources.** A failed
JavaScript parse must increment `usageSourceErrors` and trigger the same downgrade
Phase 1 applies to an unreadable HTML file, for the same reason — lost usage tokens
manufacture false positives.

## 8. Confidence

| Level | JS export | CSS selector |
|---|---|---|
| `high` | semantic mode confirms zero references | no dynamic signal reaches this class |
| `medium` | syntactic mode, no references found | an opaque signal exists; reason names its site |
| `low` | namespace-imported, re-exported, dynamically imported, or unresolved imports exist | a scoped signal's pattern matches this class |

**Namespace imports are the primary false-positive source.** `import * as utils from
'./utils'` followed by `utils.foo()` is visible syntactically as an import but not as
a member reference. Every export of a namespace-imported module drops to `low` in
syntactic mode; the TypeScript semantic layer resolves them properly and restores
`high`.

## 9. Architecture

```
src/
  parse/js.ts            babel -> ExportDef[], ImportEdge[], UsageToken[], DynamicSignal[]
  resolve/specifier.ts   specifier -> file path
  analyze/entries.ts     roots from package.json + config.entries
  analyze/graph.ts       module graph, reachability, barrel annotation
  analyze/js.ts          dead-export determination
  analyze/dynamic.ts     signal classification and reach
  analyze/cssmodules.ts  scoped usage from CSS Module imports
  analyze/semantic.ts    TypeScript Program upgrade
```

Phase 1's discipline holds: **parsers emit facts, analyzers judge.** `parse/js.ts`
never decides an export is dead.

### New types

```ts
interface ExportDef extends Position {
  name: string
  kind: 'named' | 'default' | 'reexport' | 'star-reexport'
}

interface ImportEdge {
  fromFile: string
  specifier: string
  resolved: string | null     // null means unresolved
  imported: string[]          // [] with sideEffectOnly means `import './x'`
  namespace: boolean          // import * as ns
  sideEffectOnly: boolean
}

interface DynamicSignal extends Position {
  kind: 'template-literal' | 'classlist-nonliteral' | 'helper-nonliteral' | 'computed-module-access'
  pattern: string | null      // e.g. '^btn-'; null means opaque
  scope: string | null        // stylesheet path for CSS Module signals
}
```

`UsageToken` gains `scope?: string`. `ScanResult` gains `starReexportOnly: string[]`
and `unresolvedImports: number`.

## 10. Error handling

Unchanged in shape from Phase 1. A parse failure on one file records a `ScanError` and
the scan continues. New this phase:

- A failed JS parse increments `usageSourceErrors` (section 7).
- A file using CommonJS module syntax records a warning naming the file, and is not
  analyzed for exports (section 2).
- Unresolved specifiers increment `unresolvedImports` and downgrade affected findings.

Exit codes are unchanged, including the Phase 1 rule that a scan which could not read
a usage source never exits 0.

## 11. Testing

Test-driven, extending Phase 1's suite rather than replacing it.

- Unit tests per new module against small fixtures.
- The committed torture fixture gains JavaScript cases: a dead export, a live export,
  a namespace import, a star re-export from an entry, an unresolved alias, a CSS
  Module import, a scoped template literal, and an opaque `classList.add(variable)`.
- The generative property-based tests extend to exports: generate modules with a known
  import graph and assert the reported dead set equals the constructed dead set
  exactly. The randomized oracle is what prevents a fixture-tuned implementation from
  passing, as demonstrated in Phase 1.
- Every case that produced a real defect in Phase 1 stays covered.

## 12. Sub-phases

Each ends with a working `scan`.

| Phase | Delivers |
|---|---|
| 2.1 | `parse/js.ts` and the new types; JS files parsed, nothing judged yet |
| 2.2 | Specifier resolution and the module graph |
| 2.3 | Entry discovery, dead-export determination, barrel annotation |
| 2.4 | Dynamic signal classification, literal class usage, CSS cap lift |
| 2.5 | CSS Modules scoped usage |
| 2.6 | TypeScript semantic upgrade |
| 2.7 | Docs sync, including the stated CommonJS and type-only-export gaps |

Sub-phase 2.4 is the one that changes existing CSS output. Its tests must assert that
previously-reported findings which are now provably used correctly DISAPPEAR, not just
that new ones appear.
