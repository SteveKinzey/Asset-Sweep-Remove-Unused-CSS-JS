# Asset Sweep — Find and Remove Unused CSS and JavaScript

**Asset Sweep is an open-source CLI tool that finds unused CSS selectors and dead JavaScript exports in your project, then safely removes them — cutting bundle size and fixing Lighthouse's "Reduce unused CSS" and "Reduce unused JavaScript" audits in one pass.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg "Asset Sweep is released under the MIT License")](./LICENSE)
[![Status: Pre-Alpha](https://img.shields.io/badge/status-pre--alpha-orange.svg "Asset Sweep is in early development")](#-project-status)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg "Requires Node.js 18 or later")](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-blue.svg "Contributions are welcome")](./CONTRIBUTING.md)

---

## 🚧 Project Status

> **Asset Sweep is in active early development and is not yet published to npm.** Within that limit, `asset-sweep scan` genuinely works today — the commands documented below as "works now" run against real code, not a planned interface.

**Works today**, via `asset-sweep scan`:

- Detects unused CSS selectors (classes and IDs) by cross-referencing every selector defined in your CSS against every class/id actually used in your HTML
- Scans CSS defined in `.css` files and in inline `<style>` blocks inside `.html`/`.htm`/`.xhtml` files; inline `<script>` contents are not analyzed (JavaScript analysis is not implemented — see below)
- Loads and validates `.asset-sweeprc.json` / the `assetSweep` key in `package.json`
- Safelisting via `ignoreSelectors` and `ignoreClasses` (glob patterns, e.g. `js-*`)
- Confidence scoring per finding, filterable with `--min-confidence`
- Text and JSON reports (`--report text|json`)
- CI-friendly exit codes driven by `--threshold`

**Not yet implemented** — do not rely on these:

- JavaScript analysis (dead exports, unreachable functions) — every scan reports `unusedJs: 0`
- `.vue` / `.svelte` file support
- `--report csv`
- The entire `asset-sweep clean` command (dry-run, backup, safe-mode, actual removal)

Because JavaScript is not analyzed yet, Asset Sweep cannot prove a selector is unreferenced by runtime-constructed class names — see [the confidence cap note](#-understanding-the-report) below. If you are looking for a tool to use in production **today** for the pieces not listed above, see [Alternatives](#-alternatives-and-how-asset-sweep-differs).

⭐ **Star this repo** to be notified as JavaScript analysis and `clean` land, or [open an issue](https://github.com/SteveKinzey/Asset-Sweep-Remove-Unused-CSS-JS/issues) to help shape them.

---

## Table of Contents

- [Why Unused CSS and JavaScript Matter](#-why-unused-css-and-javascript-matter)
- [What Asset Sweep Does](#-what-asset-sweep-does)
- [Alternatives and How Asset Sweep Differs](#-alternatives-and-how-asset-sweep-differs)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Command Reference](#-command-reference)
- [Configuration](#-configuration)
- [Framework Guides](#-framework-guides)
- [Understanding the Report](#-understanding-the-report)
- [CI/CD Integration](#-cicd-integration)
- [How It Works](#-how-it-works)
- [Measured Performance](#-measured-performance)
- [Limitations](#-limitations)
- [FAQ](#-frequently-asked-questions)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 📉 Why Unused CSS and JavaScript Matter

Every project accumulates dead code. A design system gets swapped out but its stylesheet stays. A feature is deleted but its utility module is still bundled. A third-party widget is removed from the markup but not the build.

That dead weight has measurable costs:

| Impact | Why it happens |
|---|---|
| **Slower Largest Contentful Paint (LCP)** | Unused CSS is still render-blocking. The browser must download and parse every byte before painting. |
| **Higher Total Blocking Time (TBT)** | Unused JavaScript is still parsed, compiled, and executed on the main thread. |
| **Failed Lighthouse audits** | Google's Lighthouse flags this directly as *Reduce unused CSS* and *Reduce unused JavaScript*. |
| **Weaker Core Web Vitals** | LCP and INP are confirmed Google ranking signals. Bloated assets degrade both. |
| **Higher bandwidth cost** | You pay egress on bytes nobody executes — on every single page view. |
| **Slower builds and reviews** | Dead code slows bundlers, inflates diffs, and misleads developers reading the codebase. |

Removing unused CSS and JavaScript is one of the highest-leverage, lowest-risk web performance optimizations available — it changes what ships to the browser without changing what the application does.

---

## ✨ What Asset Sweep Does

Asset Sweep scans your HTML and CSS, cross-references what is **defined** against what is **actually used**, and reports the difference. It aims to eventually cover JavaScript and removal too — see [Project Status](#-project-status) for what's real today versus planned.

- **🔍 Finds unused CSS selectors (works today)** — classes and IDs with no matching usage anywhere in your HTML
- **🧹 Finds dead JavaScript (planned)** — unreferenced exports, unreachable functions, and orphaned modules
- **🎯 Handles CSS and JS together (planned)** — one tool, one pass, one report, instead of stitching together separate tools
- **🛡️ Report-only today** — `scan` never modifies files; the `clean` command that would remove code is not built yet
- **🧩 Framework-agnostic markup/CSS scanning** — works with plain HTML and any framework's compiled CSS/HTML output
- **🤖 Built for CI/CD** — JSON output, configurable thresholds, and meaningful exit codes
- **⚙️ Configurable safelists** — preserve selectors your tooling injects at runtime

---

## 🔄 Alternatives and How Asset Sweep Differs

Asset Sweep is not the only way to remove unused code. Here's an honest comparison so you can pick the right tool:

| Tool | Removes unused CSS | Removes unused JS | Framework-agnostic | Notes |
|---|:---:|:---:|:---:|---|
| **Asset Sweep** | ⚠️ | ❌ | ✅ | *Finds* unused CSS today (report-only, no removal yet); JS analysis and removal are both planned. Pre-alpha — not production-ready. |
| [**PurgeCSS**](https://purgecss.com/) | ✅ | ❌ | ✅ | The mature, production-proven choice for CSS. **Use this today.** |
| [**UnCSS**](https://github.com/uncss/uncss) | ✅ | ❌ | ⚠️ | Renders pages in a headless browser. Older, less actively maintained. |
| [**Knip**](https://knip.dev/) | ❌ | ✅ | ⚠️ | Excellent for unused files, exports, and dependencies in JS/TS projects. |
| [**Tailwind CSS**](https://tailwindcss.com/) | ✅ | ❌ | ⚠️ | Purges unused utilities at build time — built in, if you're already using Tailwind. |
| **Chrome DevTools Coverage** | ⚠️ | ⚠️ | ✅ | Manual, per-page runtime measurement. Great for diagnosis, not automation. |

**Where Asset Sweep aims to fit:** most teams currently run PurgeCSS *and* Knip *and* reconcile two different reports. Asset Sweep's goal is a single command, a single unified report, and a single safelist covering both asset types.

**Being straight with you:** if you need this working in production this week, use **PurgeCSS** for CSS and **Knip** for JavaScript. They are excellent and battle-tested.

---

## 📦 Installation

> ⚠️ **Not yet published to npm.** `scan` works from a source checkout today (see below); the `npm`/`Yarn` global-install commands are the intended interface once a release ships. Star the repo to get notified.

### npm (planned)

```bash
npm install -g asset-sweep
```

### Yarn (planned)

```bash
yarn global add asset-sweep
```

### From source (works today)

```bash
git clone https://github.com/SteveKinzey/Asset-Sweep-Remove-Unused-CSS-JS.git
cd Asset-Sweep-Remove-Unused-CSS-JS
npm ci          # installs dependencies
npm run build   # compiles src/ -> dist/
npm link        # puts `asset-sweep` on your PATH
```

`asset-sweep scan <directory>` now runs for real against CSS/HTML — see [Project Status](#-project-status) for exactly what is and isn't implemented.

**Requirements:** Node.js >= 18.0.0, npm >= 9.0.0

> The package is marked `private` in `package.json` so it cannot be published
> by accident. That stays in place until JavaScript analysis and `clean`
> land too — Phase 1 (CSS-only `scan`) working is not the bar for publishing
> the whole tool.

---

## 🚀 Quick Start

```bash
# 1. See what's unused — read-only, changes nothing (works today)
asset-sweep scan ./src

# 2. Save a machine-readable report (works today)
asset-sweep scan ./src --report json --output unused-assets.json

# 3. Preview exactly what removal would do (not yet implemented)
asset-sweep clean ./src --dry-run

# 4. Remove it, keeping backups (not yet implemented)
asset-sweep clean ./src --backup --confirm
```

**Recommended first run:** start with `scan`. `clean` is not implemented yet — see [Project Status](#-project-status) — so for now, act on the report by hand and, once `clean` ships, never run `clean --confirm` against a directory that isn't committed to version control.

---

## 📖 Command Reference

### `asset-sweep scan`

Analyze a project and report unused CSS selectors. **Read-only — never modifies files.** (JavaScript is discovered but not yet analyzed — see [Project Status](#-project-status).)

```bash
asset-sweep scan <directory> [options]
```

| Option | Description | Default |
|---|---|---|
| `--include <patterns>` | Glob patterns to analyze | `**/*.{html,htm,xhtml,js,jsx,ts,tsx,vue,svelte,css}` |
| `--exclude <patterns>` | Glob patterns to skip | `**/node_modules/**,**/dist/**` |
| `--report <format>` | Output format: `text`, `json` (`csv` is not implemented yet) | `text` |
| `--threshold <percent>` | Fail (exit 1) only when unused CSS selectors, as a percentage of all CSS selectors defined (`unused / total × 100`), strictly *exceeds* this number | `0` |
| `--min-confidence <level>` | Drop findings below this confidence: `low`, `medium`, or `high`. Invalid values exit 2. | unset (no filtering) |
| `--output <file>` | Write the report to a file instead of stdout | stdout |

```bash
asset-sweep scan ./src \
  --include "**/*.{html,js,css}" \
  --exclude "vendor/**" \
  --report json \
  --output unused.json
```

### `asset-sweep clean`

> ⚠️ **Not implemented yet.** The `clean` command described below does not exist in the CLI today — running it will fail with "Usage: asset-sweep scan \<directory\> [options]". This section documents the intended interface for when it lands; see [Project Status](#-project-status).

Remove unused CSS and JavaScript. **Modifies files — read the options carefully.**

```bash
asset-sweep clean <directory> [options]
```

| Option | Description |
|---|---|
| `--dry-run` | Print every change that *would* be made without touching any file |
| `--confirm` | Skip the interactive prompt (required for non-interactive use) |
| `--backup` | Write a `.backup` copy of each file before modifying it |
| `--safe-mode` | Preserve anything the analyzer isn't fully confident about |

```bash
# Always preview first
asset-sweep clean ./src --dry-run

# Then commit to it
asset-sweep clean ./src --backup --confirm
```

---

## ⚙️ Configuration

Create `.asset-sweeprc.json` in your project root, or add an `assetSweep` key to `package.json`:

```json
{
  "assetSweep": {
    "include": ["src/**/*.{html,js,css}"],
    "exclude": ["node_modules", "dist", "build"],
    "ignoreSelectors": [".hidden", "[data-toggle]"],
    "ignoreClasses": ["js-*"],
    "preserveComments": false,
    "safeMode": false
  }
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `include` | `string[]` | `**/*.{html,htm,xhtml,js,jsx,ts,tsx,vue,svelte,css}` | Files to analyze |
| `exclude` | `string[]` | `**/node_modules/**,**/dist/**` | Files to skip |
| `ignoreSelectors` | `string[]` | `[]` | CSS selector patterns to always preserve. Glob (`*`), anchored — the pattern must match the entire raw selector text of the rule, not a fragment of it |
| `ignoreClasses` | `string[]` | `[]` | Class name patterns (glob) to always preserve |
| `preserveComments` | `boolean` | `false` | Reserved for `clean` (keep comments in modified CSS/JS) — accepted and validated today, but has no effect since `clean` doesn't exist yet |
| `safeMode` | `boolean` | `false` | Reserved for `clean` (conservative removal) — accepted and validated today, but has no effect since `clean` doesn't exist yet |

`exclude` needs the `**/` prefix (not `node_modules/**`) so it excludes nested vendor directories too, not just one directly under the scanned directory — the default was fixed for exactly this in a monorepo.

**Safelisting is the most important setting.** Any class applied at runtime — by a framework, an analytics script, or string concatenation — must be listed in `ignoreClasses` or `ignoreSelectors`, or it will be reported as unused.

---

## 🧩 Framework Guides

> ⚠️ **Reality check before you copy any command below.** Today, usage detection only parses `.css` (for definitions) and `.html`/`.htm`/`.xhtml` (for usage). `--include` controls which files are *discovered*, not which are *analyzed* — a `.jsx`, `.tsx`, `.vue`, or `.svelte` file matched by `--include` is discovered (so it doesn't break the scan) but is **not** counted in `filesAnalyzed` and its markup is never read for class/id usage — `filesAnalyzed` only counts `.css`/`.html`/`.htm`/`.xhtml` files actually parsed. So selectors used only inside component templates can be misreported as unused. Full JSX/Vue/Svelte template parsing is planned (see [Project Status](#-project-status)) but not built yet. Point `scan` at your **rendered/compiled HTML output** for accurate results today, or safelist generously in the meantime.

### React and Next.js

```bash
asset-sweep scan ./src \
  --include "**/*.{jsx,tsx,css}" \
  --exclude "**/*.test.{jsx,tsx}" \
  --report json
```

`.jsx`/`.tsx` files are discovered by this `--include` but their markup is **not yet parsed** for class usage (see the reality check above), so a class used only inside a component will be misreported as unused until you safelist it. Treat this `--include` as the target pattern for when JSX parsing ships. (`.scss` is also not compiled or parsed — only literal `.css` files are read for selector definitions.)

Safelist Next.js internals so the framework's own classes survive:

```json
{ "ignoreClasses": ["_next-*", "__next*"] }
```

### Vue and Nuxt

```bash
asset-sweep scan ./src --include "**/*.{vue,js,ts,css}"
```

`.vue` files are not parsed yet either (see the reality check above) — Single File Component `<template>` markup is invisible to `scan` today, so classes used only inside `.vue` templates will be misreported as unused until safelisted or until `.vue` support ships.

Vue scoped styles compile to `data-v-*` attributes — safelist them. `ignoreSelectors` patterns are anchored (like `ignoreClasses`): the pattern must match the **entire** raw selector text of the rule, not just a fragment of it. Vue emits the attribute in **two different shapes**, and a safelist pattern that covers only one still leaves the other reported as unused:

- The attribute on the element's own selector — the common case for an ordinary scoped style: `.my-class[data-v-f3f3eg9] { ... }`
- The attribute on an ancestor, with a descendant combinator — what `:deep()` produces: `[data-v-f3f3eg9] .my-class { ... }`

A single pattern with a wildcard on both sides covers both shapes:

```json
{ "ignoreSelectors": ["*[data-v-*]*"] }
```

### Static HTML sites

```bash
asset-sweep scan ./public \
  --include "**/*.{html,css}"
```

This is the framework guide that works fully as written today — plain `.html` and `.css` are exactly what `scan` parses. (`--safe-mode` and `--dry-run` are not shown here: both belong to the not-yet-implemented `clean` command, not `scan` — `scan` has no such flags and would silently ignore them if you added them.)

### WordPress themes

WordPress generates body and post classes server-side that never appear in your source files. Safelist them or they will be stripped:

```json
{
  "ignoreClasses": [
    "wp-*", "post-*", "page-*", "category-*",
    "logged-in", "admin-bar", "home", "single", "archive"
  ]
}
```

---

## 📊 Understanding the Report

The examples below are the actual output shape today (Phase 1: CSS only). `unusedJs` is always `0` and no JavaScript findings appear yet. File paths are printed **relative to the directory you ran `asset-sweep` from**, the same convention ESLint and `tsc` use, so they're clickable in a terminal or editor without adjustment.

A finding's `bytes` is the size (true UTF-8 byte count, not a character count) of the **CSS rule its selector belongs to** — not a slice attributable to that one selector alone. A single rule can define more than one selector (`.parent .child { ... }` defines both `.parent` and `.child`), so more than one finding can report the same `bytes` value because they share the same rule. `summary.estimatedSavings`, however, counts each distinct rule **once**, no matter how many of its selectors are unused and reported — it is not the sum of every finding's `bytes`.

### Text report

```
Asset Sweep Report
==================

Summary
  Files analyzed:    42
  Unused selectors:  287 / 640  (44.8%)
  Estimated savings: 145.2 KB

MEDIUM confidence (287)
  .old-header  src/styles.css:12  2356 bytes
  #deprecatedId  src/main.css:456  512 bytes
  why: No matching class or id found in HTML. JavaScript was not analyzed, so a class applied at runtime would not be detected.
```

### JSON report

```json
{
  "summary": {
    "filesAnalyzed": 42,
    "unusedCss": 287,
    "unusedJs": 0,
    "estimatedSavings": "145.2 KB",
    "errors": 0,
    "semanticMode": false,
    "totalCssSelectors": 640,
    "usageSourceErrors": 0
  },
  "findings": [
    {
      "type": "css-selector",
      "name": "old-header",
      "file": "src/styles.css",
      "line": 12,
      "column": 1,
      "bytes": 2356,
      "confidence": "medium",
      "reason": "No matching class or id found in HTML. JavaScript was not analyzed, so a class applied at runtime would not be detected.",
      "selectorKind": "class"
    }
  ],
  "errors": []
}
```

`selectorKind` is `"class"` or `"id"` for every `css-selector` finding — it's what the text report uses to print `.` versus `#`. `Finding.name` itself never carries a sigil.

### Why every finding says `medium`, never `high`

This is expected, not a bug. Phase 1 has no JavaScript parser, so it cannot prove a selector is never constructed dynamically at runtime (e.g. `` el.className = 'old-' + variant ``). Proving that absence is what `high` confidence requires. Until JavaScript analysis ships, every CSS finding is normally capped at `medium` — treat a `medium` finding as "no static usage found," not "provably safe to delete," and safelist anything your code assembles at runtime via `ignoreClasses` / `ignoreSelectors`.

### Why a finding sometimes says `low`, and what `usageSourceErrors` means

If a `.html` file (or any future file type that contributes usage — a "usage source") fails to read or parse, the scanner has lost real information about what's actually used, not just definitions. Rather than silently reporting the surviving findings at their usual `medium` confidence — which would assert "not found in HTML" about HTML the tool never actually read — every `css-selector` finding in that scan is downgraded to `low`, and its `reason` says plainly how many usage-source files could not be analyzed. The text report also prints a `WARNING` line above the findings, and `summary.usageSourceErrors` carries the count in JSON so CI tooling can key off it directly. A `.css` file failing to read does **not** trigger this: losing a definition can only make the tool under-report, never manufacture a false positive, so only usage-source failures downgrade confidence.

This downgrade alone isn't enough to protect CI, since `--min-confidence` can filter `low` findings out of the report entirely and `--threshold` only looks at what's left — see [Exit codes](#exit-codes) below for the hard rule that keeps a scan like this from exiting 0.

---

## 🤖 CI/CD Integration

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Scan completed, and unused CSS did not exceed `--threshold` |
| `1` | Scan completed, but unused CSS exceeded `--threshold` — **or** one or more usage-source files (currently `.html`/`.htm`/`.xhtml`) could not be read or parsed |
| `2` | Fatal: bad arguments/config, or no files matched — nothing usable was produced |

**A scan that could not read one or more usage-source files always exits `1`, never `0`**, regardless of `--threshold` or `--min-confidence`. Those files are what prove a class or id is used; without them the scan is incomplete, and its findings are downgraded to `low` confidence for exactly that reason (see [Why a finding sometimes says `low`](#-understanding-the-report) above). `--min-confidence medium` or `--threshold 100` can filter or outrank every downgraded finding in the *report*, but they cannot turn an incomplete scan into a passing exit code — CI reads the exit code, not the `WARNING` line in stdout, so the rule is enforced there directly. Check `summary.usageSourceErrors` in JSON output (or the `WARNING` line in text output) to see how many files failed and why the run isn't `0`.

### GitHub Actions

```yaml
- name: Check for unused CSS
  run: |
    asset-sweep scan ./src --report json --output unused.json --threshold 5
```

With `--threshold 5`, the command exits non-zero only when more than 5% of your CSS selectors are unused — so a pull request fails on regressions without blocking on pre-existing debt.

### Pre-commit hook

```bash
#!/bin/bash
# .husky/pre-commit
asset-sweep scan ./src --threshold 5
```

### npm scripts

`analyze` works today; the two `clean:*` scripts describe the intended interface for the not-yet-implemented `clean` command (see [Project Status](#-project-status)) and will fail with a usage error if run now:

```json
{
  "scripts": {
    "analyze": "asset-sweep scan ./src --report json",
    "clean:preview": "asset-sweep clean ./src --dry-run",
    "clean:apply": "asset-sweep clean ./src --backup --confirm"
  }
}
```

---

## 🔬 How It Works

The target pipeline is six steps; three are real today, three are not (see [Project Status](#-project-status)):

1. **Parse** *(works today, CSS/HTML only)* — Read every `.css` and `.html` file matching your `include` patterns
2. **Extract** *(works today, CSS only)* — Build an inventory of defined CSS selectors from `.css` files and from inline `<style>` blocks in `.html` files; extracting exported JS symbols is not implemented, and inline `<script>` contents are never scanned for anything
3. **Cross-reference** *(works today, against HTML only)* — Compare defined selectors to classes/ids found in `.html` files; JavaScript- and component-template-rendered markup is not read
4. **Score** *(works today, capped)* — Assign a confidence level to each unused candidate; Phase 1 caps every finding at `medium` since dynamic-class detection needs the JS parser from step 2
5. **Report** *(works today)* — Emit findings with file paths, line numbers, and estimated byte savings, as text or JSON
6. **Clean** *(not implemented)* — Remove confirmed-unused code, honoring `safeMode` and writing backups — this command does not exist in the CLI yet

Static analysis is the core tradeoff: it is fast and requires no running browser, but it cannot observe code paths that only exist at runtime. That's what the safelist is for today; `--safe-mode` is planned for `clean` and does not exist as a `scan` flag.

📄 **[ABOUT.md](./ABOUT.md)** covers the design rationale in more depth — why this is built as one pass over both asset types, and why confidence scoring is the load-bearing piece.

---

## 📏 Measured Performance

These are real measurements taken of this tool — not estimates, not targets. Run on a MacBook (macOS, Darwin 25.5.0) with Node.js 18+, against the built CLI (`dist/`), on **synthetic generated fixtures**, not a real-world project. Nothing about parallelism, streaming, or memory efficiency is implemented — this is just how long `scan` currently takes on these two inputs.

Fixture shape: N `.css` files, each containing 50 selectors, and N `.html` files, each using 25 of those selectors — so exactly half of all defined selectors are unused. `npm run benchmark [pairCount]` (`scripts/benchmark.js`) generates this exact fixture shape into a temp directory, runs `scan` against it once, prints the measurements below, and deletes the temp directory afterward — so these numbers are reproducible on any machine, not something to take on trust.

| Fixture | `pairCount` | Files | Selectors | Used | Time (3 runs) | RSS |
|---|---:|---:|---:|---:|---|---|
| A | 200 | 400 | 10,000 | 5,000 | 0.14–0.17 s | 88 MB |
| B | 1,000 | 2,000 | 50,000 | 25,000 | 0.53–0.60 s | 128–132 MB |

No claim is made here about how this scales to a real codebase, whether it stays this fast at larger sizes, or how memory behaves outside these two data points — that hasn't been measured yet.

---

## ⚠️ Limitations

Every unused-code tool shares these constraints, and they apply to `scan`'s findings today even though `clean` (mentioned below as forward guidance) is not implemented yet:

- **Dynamically constructed selectors** — `'btn-' + variant` or `` `col-${n}` `` cannot be resolved statically, and there is no JavaScript parser yet to even attempt it (see [Project Status](#-project-status)). Safelist these patterns.
- **CSS-in-JS** — styled-components and Emotion generate class names at runtime and need specific configuration; JS is not analyzed at all yet.
- **Server-rendered classes** — markup produced by a backend the scanner never sees (WordPress, Rails, Django) must be safelisted.
- **Component-template markup** — `.jsx`/`.tsx`/`.vue`/`.svelte` templates are not parsed yet either (see [Framework Guides](#-framework-guides)), so classes used only inside components look identical to genuinely dead ones.
- **Cross-domain references** — code loaded from another origin is not analyzed.
- **State-dependent styles** — selectors used only in error states, modals, or admin views may look unused if no source file references them.

**Rule of thumb (for when `clean` exists):** run `clean` only on a clean git working tree, always with `--backup`, and test the result before deploying. Until then, `scan`'s report is informational — nothing in this tool deletes code today.

---

## ❓ Frequently Asked Questions

### How do I find unused CSS in my project?

Run `asset-sweep scan ./src` for a static analysis of your whole codebase. For a per-page runtime view, Chrome DevTools' **Coverage** tab (Cmd/Ctrl+Shift+P → "Show Coverage") shows exactly which bytes executed on the page you're viewing. The two are complementary: DevTools is precise but manual and per-page; Asset Sweep is automated and project-wide.

### Is it safe to automatically remove unused CSS?

Mostly, with real caveats — and note that `clean` (the command that would actually remove code) isn't built yet, so today this is entirely about trusting the `scan` report before you act on it by hand. Static analysis cannot see class names your code builds at runtime, so safelist dynamic patterns and verify against a committed git tree (`git diff` after you make edits) before deploying. Once `clean` ships, the same caution applies to it: always run `--dry-run` first and use `--backup`.

### What's the difference between Asset Sweep and PurgeCSS?

PurgeCSS is a mature, production-proven tool that handles **CSS only**. Asset Sweep aims to handle **CSS and JavaScript together** in a single pass with one shared safelist and one unified report. Today, PurgeCSS is the right choice for production — Asset Sweep is pre-alpha.

### Will this fix my Lighthouse "Reduce unused CSS" warning?

That audit fires when Lighthouse detects render-blocking stylesheet bytes unused during page load. Removing genuinely dead selectors directly reduces it. Note that Lighthouse measures a **single page load**, so CSS used elsewhere on your site still counts as "unused" in that audit — code splitting and critical CSS extraction address that part.

### Does removing unused JavaScript improve SEO?

Indirectly but meaningfully. Unused JavaScript inflates Total Blocking Time and hurts Interaction to Next Paint (INP) — and INP is a Core Web Vitals metric Google uses as a ranking signal. Smaller bundles also reduce the crawl and render budget Googlebot spends on your pages.

### Does it work with Tailwind CSS?

Tailwind already purges unused utilities at build time via its own content scanner, so Asset Sweep adds little for Tailwind utilities specifically. It's still useful for custom CSS, legacy stylesheets, and vendor CSS alongside Tailwind; JavaScript analysis is planned but not implemented yet (see [Project Status](#-project-status)).

### How much bundle size will I actually save?

It depends entirely on how much debt has accumulated. Mature projects with several years of history and multiple design revisions typically carry the most. Run `scan` — it reports estimated savings before you change anything.

### Can I run this in CI without it breaking builds?

Yes. Use `scan` (read-only) with `--threshold`, so the build fails only when unused CSS exceeds the percentage you set. (`clean` doesn't exist yet — once it does, never run `clean --confirm` in CI against a repository you can't easily revert.)

---

## 🗺️ Roadmap

- [ ] **v0.1.0** — Core scanner, `scan` command, text and JSON reports
- [ ] **v0.2.0** — `clean` command with dry-run, backups, and safe mode
- [ ] **v0.3.0** — Config file support and safelist patterns
- [ ] Vite plugin
- [ ] Webpack plugin
- [ ] CSS-in-JS support (styled-components, Emotion)
- [ ] VS Code extension
- [ ] GitHub Action
- [ ] Performance profiling dashboard

[Vote on priorities or request a feature →](https://github.com/SteveKinzey/Asset-Sweep-Remove-Unused-CSS-JS/issues)

---

## 🤝 Contributing

Asset Sweep is early, which means contributions have outsized impact — the core scanner is still being built.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

```bash
git clone https://github.com/SteveKinzey/Asset-Sweep-Remove-Unused-CSS-JS.git
cd Asset-Sweep-Remove-Unused-CSS-JS
npm install
npm run dev
npm test
npm run build
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) and our [Code of Conduct](./CODE_OF_CONDUCT.md).

---

## 📄 License

MIT © [Steve Kinzey](https://github.com/SteveKinzey) — see [LICENSE](./LICENSE).

---

## 💬 Support

- 🐛 [Report a bug](https://github.com/SteveKinzey/Asset-Sweep-Remove-Unused-CSS-JS/issues/new?template=bug_report.md)
- 💡 [Request a feature](https://github.com/SteveKinzey/Asset-Sweep-Remove-Unused-CSS-JS/issues/new?template=feature_request.md)
- 💬 [Discussions](https://github.com/SteveKinzey/Asset-Sweep-Remove-Unused-CSS-JS/discussions)

---

<sub>**Related topics:** remove unused CSS · remove unused JavaScript · dead code elimination · reduce bundle size · web performance optimization · Core Web Vitals · Lighthouse reduce unused CSS · PurgeCSS alternative · CSS cleanup tool · tree shaking · unused selector detection</sub>
