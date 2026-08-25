# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Asset Sweep has not had a release yet. The scanner is still being built — see
the [roadmap](./README.md#-roadmap) for what v0.1.0 will include.

### Added
- `asset-sweep scan` — a working CSS scanner that cross-references CSS selectors (classes and IDs) defined in your stylesheets against actual usage in your HTML, and reports what's unused
- Config loading from `.asset-sweeprc.json` or an `assetSweep` key in `package.json`, with shape validation that rejects malformed fields instead of silently ignoring them
- Safelist support (`ignoreSelectors`, `ignoreClasses`) with glob patterns, so runtime-applied classes (e.g. `js-*`) can be excluded from findings
- Confidence scoring on every finding, filterable via `--min-confidence`; Phase 1 caps all findings at `medium` because there is no JavaScript analysis yet to prove a selector is never constructed dynamically at runtime
- Text and JSON report output (`--report text|json`), with file paths relative to the caller's working directory
- CI-friendly exit codes: `0` clean, `1` over `--threshold` (percent of unused CSS selectors, strictly exceeded), `2` on usage/config errors
- Project documentation, contribution guide, and code of conduct
- TypeScript, ESLint, Prettier, and Jest configuration
- GitHub issue templates, pull request template, and CI workflow

## Planned releases

| Version | Scope |
|---|---|
| `0.1.0` | Core scanner, `scan` command, text and JSON reports |
| `0.2.0` | `clean` command with dry-run, backups, and safe mode |
| `0.3.0` | Config file support and safelist patterns |
| `1.0.0` | Stable CLI surface and a committed public API |

Until `1.0.0`, minor version bumps may include breaking changes, per
[semver's guidance for initial development](https://semver.org/#spec-item-4).
