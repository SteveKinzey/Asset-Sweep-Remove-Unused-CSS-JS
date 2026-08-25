# Asset Sweep Scanner — Design

**Date:** 2026-08-25
**Status:** Approved, not yet implemented
**Scope:** v0.1.0 — the `scan` command. Removal (`clean`) is out of scope.

## 1. Problem

Asset Sweep must report unused CSS selectors and dead JavaScript exports across a
project, in one pass, with enough precision that a developer trusts the output.

Precision is the whole product. A dead-code tool that reports a selector as unused
when it is applied at runtime will, once `clean` exists, delete working code. Every
design decision below is subordinate to that: **when the analyzer cannot prove a
definition is unreferenced, it must say so rather than assert it.**

## 2. Scope

In scope for v0.1.0:

- `asset-sweep scan <directory> [options]`
- Unused CSS selector detection
- Dead JavaScript/TypeScript export detection
- File types: `.html` `.css` `.js` `.jsx` `.ts` `.tsx` `.vue` `.svelte`
- Confidence scoring on every finding
- Reports: `text`, `json`, `csv`
- Config via `.asset-sweeprc.json` or `package.json#assetSweep`

Out of scope for v0.1.0:

- The `clean` command and all removal, backup, and dry-run machinery
- Angular component templates, Ember, Handlebars, and other template dialects
- CSS-in-JS (styled-components, Emotion)
- Bundler plugins and editor integration

The CLI surface is fixed by the existing README (`--include`, `--exclude`,
`--report`, `--threshold`, `--output`). The implementation conforms to the
documented interface; the docs are treated as the specification.

One flag is added beyond the documented set: `--min-confidence <level>` (section 7),
which has no equivalent in the README because confidence scoring was not described
there. Phase 5 documents it. No documented flag changes meaning.

## 3. Architecture

A six-stage pipeline. Each stage is a pure function of the previous stage's output.

```
discover -> parse -> collect -> cross-reference -> score -> report
```

The governing constraint: **parsers emit facts, analyzers make judgments.** A parser
never decides that something is unused. It reports what it saw. This keeps parsers
testable against small fixtures, and means adding `.vue` support cannot change how
CSS is judged.

### Module layout

```
src/
  index.ts              public API surface: scan(dir, config) -> ScanResult
  cli.ts                argv parsing (minimist), command dispatch, exit codes
  types.ts              shared data types

  config/
    types.ts            AssetSweepConfig
    defaults.ts         documented default values
    load.ts             .asset-sweeprc.json + package.json#assetSweep, merge

  discover/
    files.ts            glob include/exclude -> FileRef[]

  parse/
    index.ts            dispatch by extension
    css.ts              postcss  -> SelectorDef[]
    html.ts             parse5   -> UsageToken[]
    js.ts               babel    -> ExportDef[] + UsageToken[] + ImportEdge[]
    sfc.ts              .vue/.svelte block split + offset mapping

  analyze/
    graph.ts            module graph from ImportEdge[]
    css.ts              unused selector determination
    js.ts               unused export determination
    semantic.ts         TypeScript Program symbol resolution
    confidence.ts       scoring rules
    safelist.ts         ignoreSelectors / ignoreClasses matching

  report/
    text.ts
    json.ts
    csv.ts
```

### Core data types

```ts
type Confidence = 'high' | 'medium' | 'low'

interface Position { file: string; line: number; column: number }

interface SelectorDef extends Position {
  kind: 'class' | 'id' | 'other'
  name: string        // 'old-header'
  raw: string         // '.old-header:hover'
  bytes: number       // size of the rule, for savings estimation
}

interface UsageToken extends Position {
  value: string
  kind: 'class' | 'id' | 'identifier' | 'dynamic'
}

interface ExportDef extends Position {
  name: string
  kind: 'named' | 'default' | 'reexport'
}

interface ImportEdge {
  fromFile: string
  toSpecifier: string
  imported: string[]      // [] means side-effect import
  namespace: boolean      // import * as ns
}

interface Finding extends Position {
  type: 'css-selector' | 'js-export'
  name: string
  bytes: number
  confidence: Confidence
  reason: string          // why this confidence, in one human sentence
}

interface ScanError {
  file: string
  message: string
}

interface ScanResult {
  summary: {
    filesAnalyzed: number
    unusedCss: number
    unusedJs: number
    estimatedSavings: string
    errors: number
    semanticMode: boolean   // true when TS symbol resolution ran
  }
  findings: Finding[]
  errors: ScanError[]
}
```

## 4. Parsing

Each file parses standalone. No stage depends on the target project having a valid
build configuration.

| Extension | Parser | Produces |
|---|---|---|
| `.css` | postcss | `SelectorDef[]` |
| `.html` | parse5 | `UsageToken[]` from `class`, `id`, and inline `<style>`/`<script>` |
| `.js` `.jsx` `.ts` `.tsx` | @babel/parser + @babel/traverse | `ExportDef[]`, `UsageToken[]`, `ImportEdge[]` |
| `.vue` `.svelte` | `sfc.ts` splitter, then the above | all of the above |

Babel runs with the `jsx` and `typescript` plugins enabled, so `.ts`/`.tsx` parse
without the target project's tsconfig. TypeScript *syntax* is always handled;
TypeScript *semantics* are the separate upgrade described in section 6.

### SFC offset mapping

`.vue` and `.svelte` files are split into `<template>`, `<script>`, and `<style>`
blocks. The splitter records each block's start offset in the original file, and
every position produced inside a block has that offset added back before it leaves
the parser.

A finding in a `<style>` block must report its true line in `Button.vue`, never the
line within the extracted fragment. This is the single easiest thing to get silently
wrong, so it is tested directly rather than only through integration tests.

## 5. Cross-reference and determination

The collector builds two sets: every definition (`SelectorDef`, `ExportDef`) and
every usage (`UsageToken`).

**CSS:** a selector is a candidate when its `name` matches no `UsageToken` of the
corresponding kind anywhere in the project, and the safelist does not preserve it.

**JS:** an export is a candidate when the module graph shows no importer resolving
that name, and it is not an entry point.

Candidacy is not a verdict. Every candidate proceeds to scoring.

## 6. TypeScript semantic layer

`typescript` is a bundled runtime dependency.

When the target directory contains a resolvable `tsconfig.json`, `semantic.ts`
builds a `ts.Program` and resolves each dead-export candidate through the type
system. This correctly handles re-export chains, `import * as ns` namespace access,
and aliased imports — cases where syntactic matching alone produces false positives.

When no usable tsconfig exists, or the Program fails to build, the scan continues in
syntactic mode. `ScanResult.summary.semanticMode` records which mode ran, the text
report prints a one-line notice, and JS findings are capped at `medium` confidence.

Bundling `typescript` means the semantic layer is always *available*; it degrades
based on the target project, never on Asset Sweep's own install.

## 7. Confidence scoring

| Level | CSS selector | JS export |
|---|---|---|
| `high` | Name matches no string token anywhere, and no dynamic class construction was detected in the project | Semantic resolution confirms zero references |
| `medium` | No match, but dynamic class construction exists somewhere | Syntactic mode, no references found |
| `low` | Prefix or partial match inside a dynamic pattern | Entry point, re-exported, or dynamically referenced |

Dynamic class construction means any of: a template literal whose quasis look like a
class fragment, `classList.add`/`remove`/`toggle` called with a non-literal, or a
class-name helper (`clsx`, `classnames`) called with a non-literal argument.

Every `Finding` carries a `reason` string explaining its level in one sentence. A
finding a user cannot evaluate is a finding they cannot act on.

Reports group by confidence, highest first. `--min-confidence <level>` filters.

## 8. Safelist

`ignoreSelectors` matches full selector strings; `ignoreClasses` matches class names
and supports `*` globs. A safelisted definition is removed before scoring and never
appears in output.

The safelist is the user's escape hatch for everything static analysis cannot see —
server-rendered classes, framework-injected attributes, runtime-constructed names.

## 9. Error handling and exit codes

A parse failure on one file records a `ScanError` and the scan continues. One
malformed vendor stylesheet must not abort a 2000-file scan. The error count appears
in every report format.

| Code | Meaning |
|---|---|
| `0` | Scan completed; unused ratio at or under `--threshold` |
| `1` | Scan completed; `--threshold` exceeded |
| `2` | Fatal: unreadable config, explicitly-requested config missing, or zero files matched |

Zero files matched is fatal, not an empty success. A wrong `--include` glob that
exits `0` makes CI green while measuring nothing.

## 10. Module system

`package.json` gains `"type": "module"`, and `tsconfig.json` moves from
`module: ESNext` to `module: NodeNext` for correct Node ESM resolution. `chalk@5` is
ESM-only, so the current configuration would fail at first run. Jest runs via
ts-jest's ESM preset.

## 11. Dependencies

Added as runtime dependencies:

| Package | Purpose |
|---|---|
| `postcss` | CSS AST |
| `@babel/parser` | JS/TS/JSX syntax |
| `@babel/traverse` | AST walking |
| `@babel/types` | AST node predicates |
| `parse5` | Spec-compliant HTML |
| `typescript` | Semantic export resolution (promoted from devDependencies) |

Already declared: `glob`, `minimist`, `chalk`.

## 12. Testing

Test-driven. Jest with ts-jest, ESM preset.

- **Unit tests per parser**, against small inline fixtures.
- **Offset-mapping tests** asserting that SFC findings report original-file lines.
- **Integration tests** over `tests/fixtures/`, a small project containing deliberate
  traps: a class used only inside a template literal; a re-export chain; a
  `<style scoped>` block; a selector appearing only inside a CSS comment; a
  namespace-imported export.

Each trap has a known expected confidence level. The fixture project is the
regression suite for the precision guarantee in section 1.

## 13. Implementation phases

Each phase ends with a working `scan`, never a half-built one.

| Phase | Delivers |
|---|---|
| 1 | Skeleton, config, discovery, CSS end-to-end, text + JSON reports |
| 2 | JS/TS export detection via Babel, module graph |
| 3 | `.vue`/`.svelte` support with offset mapping |
| 4 | TypeScript semantic layer, confidence refinement |
| 5 | CSV report, polish, sync README and ABOUT to real behavior |

Phase 5 includes removing the pre-alpha banners and the `private` flag from
`package.json` only if the scanner genuinely works — the honesty guarantees added to
the docs are not undone on schedule, they are undone on evidence.
