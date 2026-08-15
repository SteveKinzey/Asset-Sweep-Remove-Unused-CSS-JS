# Asset Sweep — Remove Unused CSS & JS

> Automatically detect and remove unused CSS and JavaScript from your web projects. Streamline your codebase, improve performance, and reduce bundle size.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Asset Sweep is a developer-focused CLI tool that analyzes your HTML, CSS, and JavaScript files to identify and remove unused styles and scripts. It helps you:

- **Reduce bundle size** by eliminating dead code
- **Improve page load performance** with smaller asset files
- **Maintain cleaner codebases** by removing unused selectors and utilities
- **Work with modern frameworks** (React, Vue, Svelte) and static HTML
- **Generate detailed reports** of what was removed and why

## Why Asset Sweep?

Most projects accumulate unused CSS and JavaScript over time. Refactoring toolchains can be complex, and it's easy to miss dead code that persists through production builds. Asset Sweep makes this process automatic and transparent.

### Key Benefits

- ✅ **No false positives** — Smart AST parsing understands your code
- ✅ **Works with any stack** — Framework-agnostic analysis
- ✅ **Safe by default** — Generates reports before making changes
- ✅ **Fast scanning** — Processes large projects in seconds
- ✅ **CI/CD ready** — Exit codes and JSON output for automation
- ✅ **Configurable** — Target specific files, ignore patterns, custom selectors

## Installation

### Via npm (recommended)
```bash
npm install -g asset-sweep
```

### Via Yarn
```bash
yarn global add asset-sweep
```

### From source
```bash
git clone https://github.com/SteveKinzey/Asset-Sweep-Remove-Unused-CSS-JS.git
cd Asset-Sweep-Remove-Unused-CSS-JS
npm install
npm run build
npm link
```

## Quick Start

### Scan a project
```bash
asset-sweep scan ./src
```

### Generate a detailed report
```bash
asset-sweep scan ./src --report json > unused-assets.json
```

### Remove unused assets (with confirmation)
```bash
asset-sweep clean ./src --confirm
```

### Dry run (preview changes)
```bash
asset-sweep clean ./src --dry-run
```

## Usage

### Command-Line Interface

#### `asset-sweep scan`
Analyze your project and report unused CSS and JavaScript.

```bash
asset-sweep scan <directory> [options]
```

**Options:**
- `--include <patterns>` — File patterns to include (default: `**/*.{html,js,jsx,ts,tsx,vue,svelte}`)
- `--exclude <patterns>` — File patterns to ignore (default: `node_modules/**,dist/**`)
- `--report <format>` — Output format: `text` (default), `json`, `csv`
- `--threshold <percent>` — Only warn if unused code exceeds threshold (0-100)
- `--output <file>` — Save report to file

**Example:**
```bash
asset-sweep scan ./src \
  --include "**/*.{html,js,css}" \
  --exclude "vendor/**" \
  --report json \
  --output unused.json
```

#### `asset-sweep clean`
Remove unused CSS and JavaScript from your project.

```bash
asset-sweep clean <directory> [options]
```

**Options:**
- `--dry-run` — Preview changes without modifying files
- `--confirm` — Skip confirmation prompt and proceed
- `--backup` — Create `.backup` copies before removing assets
- `--safe-mode` — Keep uncertain matches (conservative removal)

**Example:**
```bash
# Preview what would be removed
asset-sweep clean ./src --dry-run

# Remove with confirmation
asset-sweep clean ./src --backup --confirm
```

## Configuration

Create an `.asset-sweeprc.json` or add to your `package.json`:

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

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `include` | string[] | `**/*.{html,js,jsx,ts,tsx,vue,svelte}` | Files to analyze |
| `exclude` | string[] | `node_modules/**,dist/**` | Files to skip |
| `ignoreSelectors` | string[] | `[]` | CSS selectors to preserve |
| `ignoreClasses` | string[] | `[]` | Class name patterns to preserve |
| `preserveComments` | boolean | false | Keep CSS/JS comments |
| `safeMode` | boolean | false | Conservative removal strategy |

## Examples

### React Project
```bash
asset-sweep scan ./src \
  --include "**/*.{jsx,tsx,css,scss}" \
  --exclude "**/*.test.{jsx,tsx}" \
  --report json
```

### Next.js Project
```bash
asset-sweep scan ./src \
  --exclude "pages/api/**" \
  --ignoreClasses "_next-*,_app-*"
```

### Static HTML Site
```bash
asset-sweep scan ./public \
  --include "**/*.{html,css,js}" \
  --safe-mode \
  --dry-run
```

## Understanding Reports

### Text Report
```
Asset Sweep Report
==================

📊 Summary
  Files analyzed: 42
  Unused CSS rules: 287
  Unused JS functions: 15
  Total size savings: 145.2 KB

🎨 CSS
  Unused selectors: 287
    - .old-header (styles.css:12)
    - #deprecatedId (main.css:456)

⚙️ JavaScript
  Unused exports: 15
    - deprecatedFunction (utils.js:89)
```

### JSON Report
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
      {
        "selector": ".old-header",
        "file": "styles.css",
        "line": 12,
        "size": "2.3 KB"
      }
    ]
  },
  "javascript": {
    "unused": [
      {
        "name": "deprecatedFunction",
        "file": "utils.js",
        "line": 89,
        "type": "export"
      }
    ]
  }
}
```

## How It Works

1. **Parse** — Reads all CSS and JavaScript files in your project
2. **Analyze** — Uses AST parsing to understand code structure
3. **Cross-reference** — Matches CSS selectors and JS exports against HTML and code usage
4. **Report** — Generates detailed findings with confidence levels
5. **Clean** (optional) — Safely removes identified unused assets with backups

## Advanced Usage

### CI/CD Integration

```yaml
# GitHub Actions
- name: Check for unused assets
  run: |
    asset-sweep scan ./src --report json --output unused.json
    if [ -s unused.json ]; then
      echo "⚠️ Unused assets detected"
      cat unused.json
      exit 1
    fi
```

### Pre-commit Hook

```bash
#!/bin/bash
# .husky/pre-commit
asset-sweep scan ./src --dry-run --threshold 5
```

### NPM Scripts

```json
{
  "scripts": {
    "analyze": "asset-sweep scan ./src --report json",
    "clean": "asset-sweep clean ./src --dry-run",
    "clean:confirm": "asset-sweep clean ./src --backup --confirm"
  }
}
```

## Performance

- Scans 1000+ files in <5 seconds
- Memory-efficient streaming analysis
- Parallel processing on multi-core systems

## Browser & Framework Support

- ✅ Vanilla HTML/CSS/JS
- ✅ React / Next.js
- ✅ Vue / Nuxt
- ✅ Svelte
- ✅ Angular
- ✅ Ember
- ✅ Any framework using standard CSS/JS

## Limitations

- Does not analyze dynamically generated selectors (e.g., `'.' + className`)
- CSS-in-JS (styled-components, Emotion) requires specific configuration
- Does not track cross-domain references

## Contributing

We welcome contributions! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Setup

```bash
git clone https://github.com/SteveKinzey/Asset-Sweep-Remove-Unused-CSS-JS.git
cd Asset-Sweep-Remove-Unused-CSS-JS
npm install
npm run dev    # Start dev server
npm test       # Run tests
npm run build  # Build for production
```

## License

MIT License — see [LICENSE](./LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/SteveKinzey/Asset-Sweep-Remove-Unused-CSS-JS/wiki)
- 🐛 [Report Issues](https://github.com/SteveKinzey/Asset-Sweep-Remove-Unused-CSS-JS/issues)
- 💬 [Discussions](https://github.com/SteveKinzey/Asset-Sweep-Remove-Unused-CSS-JS/discussions)
- 🐦 [@SteveKinzey](https://twitter.com/SteveKinzey)

## Roadmap

- [ ] VS Code extension
- [ ] WebPack plugin
- [ ] Vite plugin integration
- [ ] CSS-in-JS framework support
- [ ] Performance profiling dashboard
- [ ] GitHub Actions integration

---

**Built with ❤️ by [Steve Kinzey](https://github.com/SteveKinzey)**
