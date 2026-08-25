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

**Phase 2c — dead exports — will be specced separately, built on `ts.createProgram`
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
- **Full-inventory reporting**: every selector carries a status, so nothing silently
  vanishes from the output (section 9)
- **`--report html`**: a self-contained styled report (section 10)

Out of scope:

- Dead exports, the module graph, specifier resolution, entry points, the TypeScript
  Program — all Phase 2c
- **Patch emission** — Phase 2b. Generating a correct fix is subtler than deleting
  lines: `.a, .b { }` with only `.a` dead must rewrite the selector list rather than
  drop the rule, removing the last rule from an `@media` block leaves an empty block,
  and comments and whitespace must survive. It earns its own design.
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

Consequence: some classes Phase 1 currently reports as unused are provably used. They
are RECLASSIFIED, not removed — they leave the findings list and appear in the
inventory as `used-via-js` with the file and line that proved it (section 9). Nothing
silently vanishes from the report.

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
`@/styles/x.module.css`, since alias resolution is Phase 2c — the usage is recorded
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
  analyze/inventory.ts   selector status classification
  report/html.ts         self-contained HTML, no external assets
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

## 9. Full-inventory reporting

Phase 2a's main effect is that classes Phase 1 reported as unused are now provably
used. They must not simply vanish from the report. A user cannot distinguish "correctly
resolved" from "the tool stopped looking", and the second is how a false negative
hides.

Every selector therefore carries a status:

| Status | Meaning |
|---|---|
| `unused` | no usage found; this is a finding |
| `used` | referenced in HTML |
| `used-via-js` | referenced from JavaScript — a literal class string |
| `used-via-module` | referenced through a CSS Module member access |
| `safelisted` | matched `ignoreClasses` or `ignoreSelectors` |
| `dynamic-risk` | a dynamic signal's pattern reaches this class |

A class that moves from `unused` to `used-via-js` carries the file and line that proved
it. That is what makes the tool auditable: a user who believes the tool is wrong about
a class being used can go read the evidence.

Volume is the constraint. A large project has tens of thousands of selectors, so:

- the **text** report keeps showing findings plus summary counts by default, with
  `--full` to print the whole inventory
- **JSON** always carries the full inventory, since it is consumed by tools
- the **HTML** report always carries it, collapsed by status

`ScanResult` gains `inventory: SelectorStatus[]` alongside the existing `findings`,
which remains the `unused` subset so existing consumers do not break.

## 10. HTML report

`--report html` emits a single self-contained file: no external CSS, no fonts, no
scripts loaded from a network. It opens offline and can be committed or emailed.

Contents: the summary block, a findings table grouped by confidence, and the full
inventory collapsed by status. Each row shows the selector, its status, its file and
line, and — for a `used-*` status — the evidence location.

It must print cleanly to PDF from any browser, which is the supported path to a PDF
artifact. A bundled PDF writer was considered and rejected: roughly a megabyte of
dependency, worse control of tables and long paths, manual pagination, and no way for
a user to restyle the output. Print-to-PDF gives a better document with no new
dependency.

Constraints: no dependency may be added for this. The HTML is generated by
`src/report/html.ts` from the same `ScanResult` the other formats use, and the styling
is inline. Long file paths must wrap rather than overflow, and the report must be
legible when printed on A4 and Letter.

## 11. Error handling

Unchanged in shape. A JS parse failure records a `ScanError`, increments
`usageSourceErrors`, and the scan continues. Exit codes are unchanged, including the
rule that a scan which could not read a usage source never exits 0.

## 12. Testing

- Unit tests per new module against small fixtures.
- **Reclassification tests:** fixtures where Phase 1 reports a finding and Phase 2a
  must instead classify it `used-via-js` or `used-via-module`, WITH the evidence
  location. Asserting only that it left the findings list would be weaker — the point
  is that it moved to a known status carrying proof, not that it vanished.
- The committed torture fixture gains: a literal `classList.add`, a CSS Module import
  with member access, a same-named class in a second module proving scoping, an
  unresolvable aliased module import, a prefixed template literal, and an opaque
  `classList.add(variable)`.
- The generative property-based tests extend to JS usage: generate classes used only
  from JavaScript and assert they are never reported; generate prefixed template
  literals and assert only matching classes drop to `low`.
- Every Phase 1 case stays covered and unweakened.

## 13. Sub-phases

Each ends with a working `scan`.

| Phase | Delivers |
|---|---|
| 2a.1 | `parse/js.ts` and types; JS parsed, facts extracted, nothing judged |
| 2a.2 | Literal class usage feeding CSS; JS as a usage source |
| 2a.3 | Dynamic signal classification and the cap lift |
| 2a.4 | CSS Modules scoped usage |
| 2a.5 | Full-inventory statuses in ScanResult and the text/JSON reports |
| 2a.6 | `--report html`, self-contained |
| 2a.7 | Docs sync, including what remains unanalyzed |

2a.2 and 2a.3 change existing output. Their tests must assert both directions
explicitly: that a now-provably-used class is reclassified with its evidence location,
and that a class no dynamic signal reaches reaches `high` confidence.
