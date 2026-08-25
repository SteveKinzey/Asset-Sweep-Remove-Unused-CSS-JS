# Asset Sweep — Find and Remove Unused CSS and JavaScript

**Asset Sweep is an open-source CLI tool that finds unused CSS selectors and dead JavaScript exports in your project, then safely removes them — cutting bundle size and fixing Lighthouse's "Reduce unused CSS" and "Reduce unused JavaScript" audits in one pass.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg "Asset Sweep is released under the MIT License")](./LICENSE)
[![Status: Pre-Alpha](https://img.shields.io/badge/status-pre--alpha-orange.svg "Asset Sweep is in early development")](#-project-status)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg "Requires Node.js 18 or later")](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-blue.svg "Contributions are welcome")](./CONTRIBUTING.md)

---

## 🚧 Project Status

> **Asset Sweep is in active early development. The CLI is not yet published to npm and the commands below describe the target design, not shipped behavior.**
>
> This repository currently contains the project specification, configuration, and contributor tooling. If you are looking for a tool to use in production **today**, see [Alternatives](#-alternatives-and-how-asset-sweep-differs).
>
> ⭐ **Star this repo** to be notified when v0.1.0 ships, or [open an issue](https://github.com/SteveKinzey/Asset-Sweep-Remove-Unused-CSS-JS/issues) to help shape it.

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

Asset Sweep scans your HTML, CSS, and JavaScript, cross-references what is **defined** against what is **actually used**, and reports (or removes) the difference.

- **🔍 Finds unused CSS selectors** — classes, IDs, and complex selectors with no matching usage anywhere in your markup or components
- **🧹 Finds dead JavaScript** — unreferenced exports, unreachable functions, and orphaned modules
- **🎯 Handles CSS and JS together** — one tool, one pass, one report, instead of stitching together separate tools
- **🛡️ Report-first and safe by default** — nothing is deleted until you explicitly ask, with `--dry-run` and `--backup` available
- **🧩 Framework-agnostic** — works with plain HTML, React, Next.js, Vue, Nuxt, Svelte, Angular, and WordPress themes
- **🤖 Built for CI/CD** — JSON output, configurable thresholds, and meaningful exit codes
- **⚙️ Configurable safelists** — preserve selectors your tooling injects at runtime

---

## 🔄 Alternatives and How Asset Sweep Differs

Asset Sweep is not the only way to remove unused code. Here's an honest comparison so you can pick the right tool:

| Tool | Removes unused CSS | Removes unused JS | Framework-agnostic | Notes |
|---|:---:|:---:|:---:|---|
| **Asset Sweep** | ✅ | ✅ | ✅ | Both in one pass. Pre-alpha — not production-ready yet. |
| [**PurgeCSS**](https://purgecss.com/) | ✅ | ❌ | ✅ | The mature, production-proven choice for CSS. **Use this today.** |
| [**UnCSS**](https://github.com/uncss/uncss) | ✅ | ❌ | ⚠️ | Renders pages in a headless browser. Older, less actively maintained. |
| [**Knip**](https://knip.dev/) | ❌ | ✅ | ⚠️ | Excellent for unused files, exports, and dependencies in JS/TS projects. |
| [**Tailwind CSS**](https://tailwindcss.com/) | ✅ | ❌ | ⚠️ | Purges unused utilities at build time — built in, if you're already using Tailwind. |
| **Chrome DevTools Coverage** | ⚠️ | ⚠️ | ✅ | Manual, per-page runtime measurement. Great for diagnosis, not automation. |

**Where Asset Sweep aims to fit:** most teams currently run PurgeCSS *and* Knip *and* reconcile two different reports. Asset Sweep's goal is a single command, a single unified report, and a single safelist covering both asset types.

**Being straight with you:** if you need this working in production this week, use **PurgeCSS** for CSS and **Knip** for JavaScript. They are excellent and battle-tested.

---

## 📦 Installation

> ⚠️ **Not yet published to npm.** These commands are the intended interface and will work once v0.1.0 ships. Star the repo to get notified.

### npm (planned)

```bash
npm install -g asset-sweep
```

### Yarn (planned)

```bash
yarn global add asset-sweep
```

### From source (works today for contributors)

```bash
git clone https://github.com/SteveKinzey/Asset-Sweep-Remove-Unused-CSS-JS.git
cd Asset-Sweep-Remove-Unused-CSS-JS
npm install
npm run build
npm link
```

**Requirements:** Node.js >= 18.0.0, npm >= 9.0.0

---

## 🚀 Quick Start

```bash
# 1. See what's unused — read-only, changes nothing
asset-sweep scan ./src

# 2. Save a machine-readable report
asset-sweep scan ./src --report json --output unused-assets.json

# 3. Preview exactly what removal would do
asset-sweep clean ./src --dry-run

# 4. Remove it, keeping backups
asset-sweep clean ./src --backup --confirm
```

**Recommended first run:** always start with `scan`, then `clean --dry-run`. Never run `clean --confirm` against a directory that isn't committed to version control.

---

## 📖 Command Reference

### `asset-sweep scan`

Analyze a project and report unused CSS and JavaScript. **Read-only — never modifies files.**

```bash
asset-sweep scan <directory> [options]
```

| Option | Description | Default |
|---|---|---|
| `--include <patterns>` | Glob patterns to analyze | `**/*.{html,js,jsx,ts,tsx,vue,svelte}` |
| `--exclude <patterns>` | Glob patterns to skip | `node_modules/**,dist/**` |
| `--report <format>` | Output format: `text`, `json`, `csv` | `text` |
| `--threshold <percent>` | Only fail if unused code exceeds this percentage (0–100) | `0` |
| `--output <file>` | Write the report to a file instead of stdout | stdout |

```bash
asset-sweep scan ./src \
  --include "**/*.{html,js,css}" \
  --exclude "vendor/**" \
  --report json \
  --output unused.json
```

### `asset-sweep clean`

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
| `include` | `string[]` | `**/*.{html,js,jsx,ts,tsx,vue,svelte}` | Files to analyze |
| `exclude` | `string[]` | `node_modules/**,dist/**` | Files to skip |
| `ignoreSelectors` | `string[]` | `[]` | CSS selectors to always preserve |
| `ignoreClasses` | `string[]` | `[]` | Class name patterns (glob) to always preserve |
| `preserveComments` | `boolean` | `false` | Keep comments in modified CSS/JS |
| `safeMode` | `boolean` | `false` | Conservative removal — keep uncertain matches |

**Safelisting is the most important setting.** Any class applied at runtime — by a framework, an analytics script, or string concatenation — must be listed in `ignoreClasses` or `ignoreSelectors`, or it will be reported as unused.

---

## 🧩 Framework Guides

### React and Next.js

```bash
asset-sweep scan ./src \
  --include "**/*.{jsx,tsx,css,scss}" \
  --exclude "**/*.test.{jsx,tsx}" \
  --report json
```

Safelist Next.js internals so the framework's own classes survive:

```json
{ "ignoreClasses": ["_next-*", "__next*"] }
```

### Vue and Nuxt

```bash
asset-sweep scan ./src --include "**/*.{vue,js,ts,css}"
```

Vue scoped styles compile to `data-v-*` attributes — safelist them:

```json
{ "ignoreSelectors": ["[data-v-*]"] }
```

### Static HTML sites

```bash
asset-sweep scan ./public \
  --include "**/*.{html,css,js}" \
  --safe-mode \
  --dry-run
```

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

### Text report

```
Asset Sweep Report
==================

📊 Summary
  Files analyzed: 42
  Unused CSS rules: 287
  Unused JS exports: 15
  Estimated savings: 145.2 KB

🎨 CSS
  Unused selectors: 287
    - .old-header       (styles.css:12)
    - #deprecatedId     (main.css:456)

⚙️ JavaScript
  Unused exports: 15
    - deprecatedFunction (utils.js:89)
```

### JSON report

```json
{
  "summary": {
    "filesAnalyzed": 42,
    "unusedCss": 287,
    "unusedJs": 15,
    "estimatedSavings": "145.2 KB"
  },
  "css": {
    "unused": [
      { "selector": ".old-header", "file": "styles.css", "line": 12, "size": "2.3 KB" }
    ]
  },
  "javascript": {
    "unused": [
      { "name": "deprecatedFunction", "file": "utils.js", "line": 89, "type": "export" }
    ]
  }
}
```

---

## 🤖 CI/CD Integration

### GitHub Actions

```yaml
- name: Check for unused CSS and JavaScript
  run: |
    asset-sweep scan ./src --report json --output unused.json --threshold 5
```

With `--threshold 5`, the command exits non-zero only when more than 5% of your assets are unused — so a pull request fails on regressions without blocking on pre-existing debt.

### Pre-commit hook

```bash
#!/bin/bash
# .husky/pre-commit
asset-sweep scan ./src --dry-run --threshold 5
```

### npm scripts

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

1. **Parse** — Read every CSS and JavaScript file matching your `include` patterns
2. **Extract** — Build an inventory of defined CSS selectors and exported JS symbols
3. **Cross-reference** — Walk the AST of your markup and components to find every actual usage
4. **Score** — Assign a confidence level to each unused candidate; dynamic patterns score lower
5. **Report** — Emit findings with file paths, line numbers, and estimated byte savings
6. **Clean** *(optional)* — Remove confirmed-unused code, honoring `safeMode` and writing backups

Static analysis is the core tradeoff: it is fast and requires no running browser, but it cannot observe code paths that only exist at runtime. That's what the safelist and `--safe-mode` are for.

---

## ⚠️ Limitations

Every unused-code tool shares these constraints. Know them before running `clean`:

- **Dynamically constructed selectors** — `'btn-' + variant` or `` `col-${n}` `` cannot be resolved statically. Safelist these patterns.
- **CSS-in-JS** — styled-components and Emotion generate class names at runtime and need specific configuration.
- **Server-rendered classes** — markup produced by a backend the scanner never sees (WordPress, Rails, Django) must be safelisted.
- **Cross-domain references** — code loaded from another origin is not analyzed.
- **State-dependent styles** — selectors used only in error states, modals, or admin views may look unused if no source file references them.

**Rule of thumb:** run `clean` only on a clean git working tree, always with `--backup`, and test the result before deploying.

---

## ❓ Frequently Asked Questions

### How do I find unused CSS in my project?

Run `asset-sweep scan ./src` for a static analysis of your whole codebase. For a per-page runtime view, Chrome DevTools' **Coverage** tab (Cmd/Ctrl+Shift+P → "Show Coverage") shows exactly which bytes executed on the page you're viewing. The two are complementary: DevTools is precise but manual and per-page; Asset Sweep is automated and project-wide.

### Is it safe to automatically remove unused CSS?

Mostly, with real caveats. Static analysis cannot see class names your code builds at runtime, so always run `--dry-run` first, use `--backup`, safelist dynamic patterns, and test before deploying. Run it against a committed git tree so `git diff` shows you every change.

### What's the difference between Asset Sweep and PurgeCSS?

PurgeCSS is a mature, production-proven tool that handles **CSS only**. Asset Sweep aims to handle **CSS and JavaScript together** in a single pass with one shared safelist and one unified report. Today, PurgeCSS is the right choice for production — Asset Sweep is pre-alpha.

### Will this fix my Lighthouse "Reduce unused CSS" warning?

That audit fires when Lighthouse detects render-blocking stylesheet bytes unused during page load. Removing genuinely dead selectors directly reduces it. Note that Lighthouse measures a **single page load**, so CSS used elsewhere on your site still counts as "unused" in that audit — code splitting and critical CSS extraction address that part.

### Does removing unused JavaScript improve SEO?

Indirectly but meaningfully. Unused JavaScript inflates Total Blocking Time and hurts Interaction to Next Paint (INP) — and INP is a Core Web Vitals metric Google uses as a ranking signal. Smaller bundles also reduce the crawl and render budget Googlebot spends on your pages.

### Does it work with Tailwind CSS?

Tailwind already purges unused utilities at build time via its own content scanner, so Asset Sweep adds little for Tailwind utilities specifically. It's still useful for custom CSS, legacy stylesheets, vendor CSS, and unused JavaScript alongside Tailwind.

### How much bundle size will I actually save?

It depends entirely on how much debt has accumulated. Mature projects with several years of history and multiple design revisions typically carry the most. Run `scan` — it reports estimated savings before you change anything.

### Can I run this in CI without it breaking builds?

Yes. Use `scan` (read-only) with `--threshold`, so the build fails only when unused code exceeds the percentage you set. Never run `clean --confirm` in CI against a repository you can't easily revert.

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
