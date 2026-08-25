# Asset Sweep Phase 2a — JavaScript-Aware CSS Analysis

**Date:** 2026-08-25
**Status:** Approved, not yet implemented
**Builds on:** `2026-08-25-asset-sweep-scanner-design.md` (Phase 1, shipped and merged)
**Supersedes:** the earlier combined Phase 2 design, split for the reasons in section 2

## 1. Problem

Phase 1 ships a working CSS scanner with two known weaknesses, both caused by the same
gap — it cannot read JavaScript:

1. **It is wrong on React and Next.js codebases.** `import s from './x.module.css'`
   followed by `s.wrapper` is the dominant styling pattern, and nothing in the HTML
   references those classes. Phase 1 reports essentially every CSS Module class as
   unused. On such a project that is most of the stylesheet.
2. **Every finding says `medium`.** `scoreCssFinding()` returns `medium`
   unconditionally, because `high` requires proving no dynamic class construction
   exists, which needs a JavaScript parser. A user has never seen this tool express
   confidence.

Phase 2a fixes both by parsing JavaScript for **facts about CSS usage only**. It does
not analyze exports.

## 2. Why this is split from dead-export analysis

The original Phase 2 design combined JS-aware CSS with dead-export detection. They have
very different costs and very different payoffs.

Everything in Phase 2a needs only single-file parsing: read a JS file, extract facts,
done. No module graph, no specifier resolution, no entry-point discovery, no
TypeScript Program.

Dead-export analysis needs all four, and each is a place to be subtly wrong in a way
that produces false positives. Correct module resolution alone means handling
conditional `exports` maps, `#`-prefixed `imports`, workspaces, symlinks, `baseUrl`,
wildcard `paths` with multiple candidates, and extension-priority differences between
tsc, Vite, and webpack. Every gap makes an import invisible, and an invisible import
makes a live export look dead.

Splitting means the work that makes the SHIPPED feature correct lands first, and the
work that builds a new feature is specced on its own terms.

**Phase 2b — dead exports — will be specced separately, built on `ts.createProgram`
with `allowJs: true` and the language service's `findReferences`, rather than a
hand-rolled Babel module graph.** TypeScript already solves resolution, re-export
chains, namespace-import member resolution, and CommonJS. A syntactic graph would
spend most of its output on low-confidence findings users learn to ignore. That
decision is recorded here so the reasoning is not lost, but its design belongs to its
own spec.

## 3. Scope

In scope:

- Parse `.js` `.jsx` `.ts` `.tsx` with Babel, for facts only
- Literal class strings in JavaScript counted as CSS usage
- CSS Modules: default-import + member access as **scoped** usage
- Dynamic class construction detection, **classified by reach**
- Lifting the CSS confidence cap
- JavaScript files becoming usage sources for error handling

Out of scope:

- Dead exports, the module graph, specifier resolution, entry points, the TypeScript
  Program — all Phase 2b
- `.vue` / `.svelte` — Phase 3
- The `clean` command

There is no CommonJS limitation in this phase. That gap only existed because
dead-export analysis needed ESM export records; extracting literal class strings and
dynamic signals works identically in CJS and ESM source.

## 4. Literal class strings as usage

These are real CSS usage Phase 1 could not see:

| Pattern | Yields |
|---|---|
| `classList.add('foo')`, `.remove`, `.toggle`, `.replace` | usage of `foo` |
| `className = 'a b'` / `className: 'a b'` | usage of `a` and `b` |
| `clsx('a', cond && 'b')`, `classnames(...)` | usage of `a` and `b` |
| `setAttribute('class', 'a b')` | usage of `a` and `b` |
| `<div className="a b">` in JSX | usage of `a` and `b` |

Only **literal** strings count. A non-literal argument is a dynamic signal instead
(section 6), never a usage — treating an unknown value as usage would suppress genuine
findings.

Consequence: some findings Phase 1 currently reports will correctly DISAPPEAR. Tests
must assert that disappearance explicitly, not merely that new behavior appears.

## 5. CSS Modules

For `import s from './Button.module.css'`, member access on `s` is usage of the
corresponding class — `s.wrapper`, `s['wrapper']`, `s?.wrapper`.

**Usage is SCOPED to that stylesheet.** `s.wrapper` in one component must not mark
`.wrapper` used in a different `.module.css`. `UsageToken` gains an optional `scope`
field naming the stylesheet path; unscoped tokens keep applying globally as today.

Resolving the stylesheet path is deliberately narrow. A CSS Module specifier carries
an explicit `.css` extension, so no extension guessing or index resolution is needed —
a relative specifier resolves against the importing file's directory and nothing more.

**When a specifier cannot be resolved** — an aliased path such as
`@/styles/x.module.css`, since alias resolution is Phase 2b — the usage is recorded
**unscoped** rather than dropped. Unscoped means it applies globally: more
conservative, and it cannot manufacture a false positive. Dropping it would.

`s[dynamicKey]` with a non-literal key is an opaque signal scoped to that stylesheet.

Classes inside `:global(...)` are not module-scoped by the bundler and are treated as
ordinary global selectors.

## 6. Dynamic class construction, classified by reach

A project-wide "dynamic construction exists" boolean would be useless. `clsx`,
`classnames`, or a single `` `btn-${size}` `` appears in nearly every modern codebase,
so a blanket flag leaves every finding at `medium` forever — the cap would be "lifted"
in name only.

Signals are classified by what they can actually produce:

| Signal | Reach | Effect |
|---|---|---|
| `` `btn-${x}` `` | classes matching `^btn-` | those -> `low`; all others unaffected |
| `` `${x}-btn` `` | classes matching `-btn$` | those -> `low`; all others unaffected |
| `` `a-${x}-b` `` | matching `^a-` and `-b$` | those -> `low` |
| `` `${a}${b}` `` — no static part | unbounded | **opaque** |
| `classList.add(v)`, non-literal | unbounded | **opaque** |
| `clsx(v)`, non-literal | unbounded | **opaque** |
| `s[k]` on a CSS Module, non-literal | that stylesheet only | **opaque, scoped** |

Resulting confidence:

- **No signal reaches a class** -> `high`
- **A scoped signal's pattern matches it** -> `low`, reason names the constructing site
- **An opaque signal exists** -> `medium`, reason names the opaque site

**Precedence when both apply:** the lower level wins, so a class matching a scoped
pattern is `low` even when an opaque signal also exists. A pattern match is specific
evidence about that class; an opaque signal is general uncertainty.

A scoped opaque signal (CSS Module computed access) caps only its own stylesheet.

## 7. JavaScript as a usage source

Because JS files now contribute usage tokens, a failed JS parse loses usage exactly as
an unreadable HTML file does. `.js` `.jsx` `.ts` `.tsx` therefore become usage sources:
a parse failure increments `usageSourceErrors`, downgrades findings, and keeps the exit
code non-zero, following the rule Phase 1 already established.

## 8. Architecture

```
src/
  parse/js.ts            babel -> UsageToken[], DynamicSignal[], CssModuleImport[]
  analyze/dynamic.ts     signal classification, reach matching
  analyze/cssmodules.ts  scoped usage from module imports
  analyze/confidence.ts  extended: replaces the unconditional 'medium'
```

Phase 1's discipline holds: **parsers emit facts, analyzers judge.** `parse/js.ts`
never decides a selector is unused, and never decides a signal's effect.

### Types

```ts
interface DynamicSignal extends Position {
  kind: 'template-literal' | 'nonliteral-arg' | 'computed-module-access'
  prefix: string | null     // '^btn-' style static head, null if none
  suffix: string | null     // '-btn' style static tail, null if none
  scope: string | null      // stylesheet path for CSS Module signals
}                           // prefix === null && suffix === null  =>  opaque

interface CssModuleImport {
  binding: string           // local name, e.g. 's'
  specifier: string
  resolved: string | null   // null -> usage recorded unscoped
}
```

`UsageToken` gains `scope?: string`.
`ScanResult.summary` gains `dynamicSignals: number` and `opaqueSignals: number`.

## 9. Error handling

Unchanged in shape. A JS parse failure records a `ScanError`, increments
`usageSourceErrors`, and the scan continues. Exit codes are unchanged, including the
rule that a scan which could not read a usage source never exits 0.

## 10. Testing

- Unit tests per new module against small fixtures.
- **Disappearance tests:** fixtures where Phase 1 reports a finding and Phase 2a must
  not, because JS proves the class is used. Asserting only new behavior would miss the
  point of this phase.
- The committed torture fixture gains: a literal `classList.add`, a CSS Module import
  with member access, a same-named class in a second module proving scoping, an
  unresolvable aliased module import, a prefixed template literal, and an opaque
  `classList.add(variable)`.
- The generative property-based tests extend to JS usage: generate classes used only
  from JavaScript and assert they are never reported; generate prefixed template
  literals and assert only matching classes drop to `low`.
- Every Phase 1 case stays covered and unweakened.

## 11. Sub-phases

Each ends with a working `scan`.

| Phase | Delivers |
|---|---|
| 2a.1 | `parse/js.ts` and types; JS parsed, facts extracted, nothing judged |
| 2a.2 | Literal class usage feeding CSS; JS as a usage source |
| 2a.3 | Dynamic signal classification and the cap lift |
| 2a.4 | CSS Modules scoped usage |
| 2a.5 | Docs sync, including what remains unanalyzed |

2a.2 and 2a.3 change existing output. Their tests must assert the disappearance of
now-provably-used findings and the appearance of `high` confidence, both explicitly.
