# Contributing to Asset Sweep

## Code of Conduct

This project adopts the [Contributor Covenant](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How to Contribute

### Reporting Bugs

- **Check existing issues first** — your bug may already be reported
- **Be specific** — include WordPress version, theme, active plugins, and exact steps to reproduce
- **Include Debug Mode output** — enable Debug Mode and share what shows in View Source
- **Test the latest version** — confirm it's not already fixed

### Suggesting Enhancements

- **Describe the problem** — what asset are you trying to remove, and why?
- **Explain the solution** — how should Asset Sweep handle it?
- **Show performance impact** — if it's about speed, include before/after numbers
- **Link to related issues** — does this build on or compete with something else?

### Submitting Code

1. **Fork the repository**
2. **Create a branch** — `git checkout -b feature/your-feature-name`
3. **Make your changes**
   - Follow the existing code style (see below)
   - Add tests for new functionality
   - Update docs if behavior changes
4. **Test thoroughly**
   - Run the test suite: `npm test`
   - Test on a real WordPress site if your change touches the plugin
   - Use Debug Mode to verify no handle is missed
5. **Commit with a clear message**
   ```
   git commit -m "feat: add support for removing custom handle X
   
   - Adds a new toggle for custom handle
   - Includes debug output verification
   - Updates settings page UI
   ```
6. **Push to your fork** — `git push origin feature/your-feature-name`
7. **Open a Pull Request** — describe what you changed and why

### Development Setup

```bash
git clone https://github.com/SteveKinzey/Asset-Sweep-Remove-Unused-CSS-JS.git
cd Asset-Sweep-Remove-Unused-CSS-JS

# For the CLI tool
npm install
npm run build

# For the WordPress plugin
# Copy wordpress-plugin/ folder to a local WordPress site's wp-content/plugins/
# Enable debug mode and test
```

### Code Style

- **JavaScript:** Use modern ES2020+ syntax
- **PHP:** Follow WordPress Coding Standards (use `phpcs` if available)
- **Commit messages:** Use conventional commits (feat:, fix:, docs:, test:, etc.)
- **Comments:** Document the "why," not the "what"

### Testing

Before submitting a PR:

```bash
npm test                    # Run unit tests
npm run build              # Ensure build succeeds
npm run lint              # Check code style
```

For the WordPress plugin:
- Run the PHP syntax check used by CI (requires PHP):
  ```bash
  find wordpress-plugin -name '*.php' -print0 | xargs -0 -n 1 php -l
  ```
- Test on a fresh WordPress install
- Test with Elementor, Divi, and standard Gutenberg
- Verify all toggles work independently
- Check Debug Mode output is accurate

### What We're Looking For

✅ **Good candidates for contribution:**
- Bug fixes (with test cases)
- New dequeuing rules (with documentation)
- Performance improvements
- Better test coverage
- Documentation improvements
- Accessibility fixes

❌ **We'll likely decline:**
- Changes that require JavaScript on the front end (Asset Sweep is CSS/JS *removal*, not manipulation)
- Opinionated styling changes (this is a utility, not a design tool)
- Features that duplicate existing WordPress functionality

### Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation only
- `style:` Code style changes (formatting, semicolons, etc.)
- `test:` Test additions or changes
- `chore:` Dependency updates, build scripts, etc.

**Examples:**
```
feat(wp-plugin): add settings page validation
fix(cli): handle empty directory correctly
docs: update README with example
```

### Questions?

Open an issue with the `question` label or start a discussion. We're here to help.

---

**Thank you for contributing to Asset Sweep!** 🙏
