# About Asset Sweep

> **Status:** Asset Sweep is pre-alpha. The CSS-vs-HTML half of the "Collection"
> and "Cross-reference" phases below is implemented and working (`asset-sweep scan`);
> JavaScript analysis, the `clean` command, and everything else described here as
> "intended" is not built yet. This document records the intended design and the
> reasoning behind it. For the current, precise split of what runs today versus
> what's planned, see the [README's Project Status](./README.md#-project-status).

## Why build another cleanup tool

Removing dead CSS and JavaScript is a solved problem in pieces and an unsolved
problem as a whole. [PurgeCSS](https://purgecss.com/) handles CSS well.
[Knip](https://knip.dev/) handles unused JavaScript exports well. Bundler
tree-shaking handles module graphs well.

What no tool does today is treat them as one question. In practice a deleted
feature leaves behind *both* its stylesheet rules and its utility module, and the
same safelist governs both — a class applied at runtime and the function that
applies it are the same decision. Running two tools means maintaining two configs,
reconciling two reports, and safelisting the same dynamic pattern twice.

Asset Sweep's bet is that one pass, one safelist, and one report is worth building
even though the individual halves already exist.

## Intended technical approach

A four-phase static analysis, no browser required:

1. **Collection** — parse HTML, CSS, and JavaScript; inventory every CSS selector
   defined and every JavaScript export declared
2. **Cross-reference** — walk templates and components for selector usage and
   symbol references; build a usage graph
3. **Analysis** — flag definitions with no references, and score each finding by
   confidence, since dynamically constructed names cannot be resolved statically
4. **Reporting** — emit human-readable and JSON output, highest-confidence findings
   first

Confidence scoring is the load-bearing part. A tool that reports everything it
cannot prove is used will delete working code the first time someone writes
`` `col-${n}` ``. Ranking by confidence, defaulting to preservation, and requiring
an explicit flag to modify files are what make automated removal defensible.

## Design principles

1. **Suggest, don't force** — reporting is the default; removal is opt-in
2. **Safe by default** — dry-run and backups exist because static analysis has
   blind spots, and pretending otherwise costs users their working code
3. **Explain every finding** — a removal you cannot justify is one you should not
   make
4. **One tool, any stack** — framework-specific solutions fragment the problem
5. **No invented numbers** — performance claims get published when they come from
   real benchmarks against real projects, not before

## Direction

Roughly in order of intended priority:

- Core scanner and the `scan` command *(done for CSS-vs-HTML; JavaScript analysis still pending)*
- `clean` with dry-run, backups, and safe mode *(not started)*
- Vite and webpack plugins
- CSS-in-JS support (styled-components, Emotion)
- Editor integration for inline feedback

The [roadmap](./README.md#-roadmap) tracks what is actually committed to.

## Prior art

Asset Sweep borrows liberally: **PurgeCSS** for CSS extraction strategy, **Knip**
for how to reason about unused exports, **ESLint** for configuration and plugin
architecture, and **Prettier** for the principle that tooling should need almost
no configuration to be useful.

## Contributing

Only the CSS-vs-HTML scanner exists so far — JavaScript analysis, `clean`, and
everything past that is still unbuilt, which makes this an unusually good time to
shape it. See [CONTRIBUTING.md](./CONTRIBUTING.md) and the
[open issues](https://github.com/SteveKinzey/Asset-Sweep-Remove-Unused-CSS-JS/issues).
