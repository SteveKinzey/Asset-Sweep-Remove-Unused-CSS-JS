# About Asset Sweep

## The Problem

Every codebase accumulates technical debt over time. As features are added, removed, and refactored, CSS rules and JavaScript functions often remain even after they're no longer used. This dead code:

- **Slows down page loads** — Larger asset files = slower parsing and execution
- **Increases bundle size** — Every KB matters on mobile networks
- **Makes maintenance harder** — Developers waste time deciphering what code is actually needed
- **Creates false complexity** — Understanding the actual codebase becomes increasingly difficult

Traditional approaches to solving this problem are either:
1. **Manual audits** — Time-consuming, error-prone, and needs to be repeated constantly
2. **Tree-shaking tools** — Only work with certain bundlers and frameworks
3. **CSS-in-JS libraries** — Add runtime overhead and aren't suitable for all projects
4. **Custom scripts** — Require deep framework knowledge to build correctly

## Our Solution

Asset Sweep was built to solve this problem once and for all. It's a framework-agnostic tool that works with any codebase—whether you're using React, Vue, vanilla JavaScript, or even static HTML.

### What Makes Asset Sweep Different

**🎯 Universal Compatibility**
- Works with any stack or framework
- No configuration needed for most projects
- Handles both modern and legacy codebases

**🔍 Intelligent Analysis**
- AST-based parsing understands your code structure
- Tracks actual usage patterns, not just file imports
- Minimizes false positives with confidence scoring

**👁️ Visibility & Control**
- Detailed reports show exactly what's unused and why
- Dry-run mode lets you preview changes before committing
- Never makes changes without your explicit approval

**⚡ Performance-First**
- Scans massive codebases in seconds
- Streaming analysis means constant memory footprint
- Parallel processing on modern hardware

**🔄 CI/CD Ready**
- JSON output for automation
- Exit codes for build pipeline integration
- GitHub Actions, pre-commit hooks, and more

## Use Cases

### 1. **Legacy Application Cleanup**
Inherited a 10-year-old codebase with accumulated cruft? Asset Sweep identifies what can safely be removed, helping you modernize incrementally.

### 2. **Performance Optimization**
Working toward Core Web Vitals goals? Dead code removal is often the quick win that frees up your performance budget.

### 3. **Dependency Removal**
Unsure which utility libraries you actually use? Asset Sweep reveals unused CSS frameworks or JavaScript helpers so you can drop them entirely.

### 4. **Migration Support**
Migrating from one framework to another? Use Asset Sweep to identify dead code in the old framework before removing it.

### 5. **Continuous Maintenance**
Run it as part of your CI/CD pipeline to catch regressions—when a feature is removed, Asset Sweep ensures its styles and scripts are deleted too.

### 6. **Team Onboarding**
Help new team members understand what code matters by showing them what doesn't. It's a powerful learning tool for understanding large codebases.

## Technical Approach

Asset Sweep uses a multi-pass analysis strategy:

### Phase 1: Collection
- Parse all HTML, CSS, and JavaScript files
- Extract all CSS selectors and class/ID definitions
- Extract all JavaScript exports and function declarations

### Phase 2: Cross-Reference
- Scan HTML and template files for CSS class/ID usage
- Scan JavaScript for function/export references
- Build a dependency graph of what's used

### Phase 3: Analysis
- Identify selectors with no references
- Identify functions with no calls
- Calculate confidence scores for each finding
- Estimate size savings

### Phase 4: Reporting
- Generate human-readable reports
- Provide JSON output for tooling
- Highlight high-confidence matches first

## Performance Impact

Typical projects see:
- **10-30% reduction** in CSS file size
- **5-15% reduction** in JavaScript file size
- **15-20ms faster** FCP (First Contentful Paint)
- **50-200ms faster** LCP (Largest Contentful Paint)

These numbers compound when combined with other optimization techniques like minification and compression.

## Philosophy

We believe:

1. **Developers should have control** — Tools should suggest, not force
2. **Dead code removal should be safe** — Verification and dry-runs reduce risk
3. **Performance matters** — Every KB matters, especially on mobile networks
4. **Transparency is essential** — You should understand what's being removed and why
5. **Simplicity wins** — One tool that works everywhere beats specialized solutions for each framework

## Who Built This

Asset Sweep was created by developers who have felt the pain of bloated codebases and wanted a better way. We've worked on projects ranging from small startups to enterprise applications, and we saw this problem repeated everywhere.

The tool draws inspiration from successful projects like:
- **PurgeCSS** — For CSS removal strategies
- **Webpack** — For AST analysis approaches
- **ESLint** — For plugin architecture and configuration
- **Prettier** — For the philosophy that tooling should "just work"

## Future Vision

We're committed to making Asset Sweep the standard for asset cleanup:

- **IDE Integration** — Real-time feedback in VS Code and other editors
- **Build Tool Plugins** — First-class webpack, Vite, and esbuild integration
- **Web Dashboard** — Visual reporting and progress tracking
- **Team Features** — Share reports, set organization standards
- **Advanced Analysis** — CSS-in-JS support, runtime tracking integration
- **Performance Profiler** — Automatic impact measurement

## Get Involved

Asset Sweep is open source and community-driven. We welcome:
- Bug reports and feature requests
- Pull requests and code contributions
- Framework-specific configurations
- Documentation improvements
- Real-world case studies

## Quick Links

- **Repository** — [github.com/SteveKinzey/Asset-Sweep-Remove-Unused-CSS-JS](https://github.com/SteveKinzey/Asset-Sweep-Remove-Unused-CSS-JS)
- **Issues** — Report bugs or request features
- **Discussions** — Ask questions and share ideas
- **Contributing** — [CONTRIBUTING.md](./CONTRIBUTING.md)

---

**Made for developers, by developers. Keeping the web fast, one unused selector at a time.**
