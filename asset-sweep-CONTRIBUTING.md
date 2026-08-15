# Contributing to Asset Sweep

First off, thank you for considering contributing to Asset Sweep! It's people like you that make Asset Sweep such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to [contact info].

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title**
* **Describe the exact steps which reproduce the problem** in as many details as possible
* **Provide specific examples to demonstrate the steps**
* **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior
* **Explain which behavior you expected to see instead and why**
* **Include screenshots and animated GIFs if possible**
* **Include your environment details**:
  - Asset Sweep version
  - Node version
  - Operating system
  - Project type (React, Vue, vanilla, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title**
* **Provide a step-by-step description of the suggested enhancement** in as many details as possible
* **Provide specific examples to demonstrate the steps**
* **Describe the current behavior** and **explain the expected behavior** and why that behavior would be useful
* **Explain why this enhancement would be useful** to most Asset Sweep users
* **List some other tools or applications where this enhancement exists** if applicable

### Pull Requests

* Fill in the required template
* Follow the JavaScript/TypeScript styleguides
* Document new code based on the existing style
* End all files with a newline
* Avoid platform-dependent code

## Development Setup

### Prerequisites
- Node.js 14.0.0 or higher
- npm or yarn

### Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally:
```bash
git clone https://github.com/your-username/Asset-Sweep-Remove-Unused-CSS-JS.git
cd Asset-Sweep-Remove-Unused-CSS-JS
```

3. Add the upstream repository:
```bash
git remote add upstream https://github.com/SteveKinzey/Asset-Sweep-Remove-Unused-CSS-JS.git
```

4. Install dependencies:
```bash
npm install
```

5. Create a branch for your work:
```bash
git checkout -b feature/my-feature
```

### Development Workflow

```bash
# Start development server (with file watching)
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Build for production
npm run build

# Lint code
npm run lint

# Format code
npm run format

# Check types (if TypeScript)
npm run type-check
```

### Project Structure

```
Asset-Sweep-Remove-Unused-CSS-JS/
├── src/
│   ├── cli/              # CLI command implementations
│   ├── analysis/         # Core analysis engines
│   ├── parsers/          # CSS/JS/HTML parsers
│   ├── reporters/        # Report generators
│   └── utils/            # Utility functions
├── tests/                # Test files
├── docs/                 # Documentation
└── examples/             # Example projects
```

### Code Style

We use ESLint and Prettier to maintain consistent code style. Before committing:

```bash
npm run format
npm run lint
```

#### TypeScript Guidelines
- Use strict mode (`"strict": true`)
- Define types explicitly (avoid `any`)
- Export types and interfaces from modules
- Use meaningful type names

#### JavaScript Guidelines
- Use ES6+ features (arrow functions, const/let, destructuring)
- Write clear, self-documenting code
- Add comments for complex logic
- Keep functions small and focused

### Testing

We maintain high test coverage. Please add tests for:
- New features
- Bug fixes
- Edge cases

```bash
# Run all tests
npm test

# Run tests for a specific file
npm test -- analysis.test.js

# Generate coverage report
npm test -- --coverage
```

#### Test Structure
```javascript
describe('Feature Name', () => {
  it('should do something specific', () => {
    // Arrange
    const input = ...;
    
    // Act
    const result = myFunction(input);
    
    // Assert
    expect(result).toBe(expected);
  });
});
```

### Commit Messages

We follow the Conventional Commits format for clear commit history:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type:**
- `feat:` A new feature
- `fix:` A bug fix
- `docs:` Documentation only changes
- `style:` Changes that don't affect code meaning (formatting, semicolons, etc.)
- `refactor:` Code change that neither fixes a bug nor adds a feature
- `perf:` Code change that improves performance
- `test:` Adding or updating tests
- `chore:` Changes to build process, dependencies, or tooling

**Examples:**
```
feat(cli): add --safe-mode flag for conservative removal

fix(parser): correctly handle CSS pseudo-elements

docs: update installation instructions for Windows

test(analysis): add test for circular dependency detection
```

### Making a Pull Request

1. Update your branch with the latest from upstream:
```bash
git fetch upstream
git rebase upstream/main
```

2. Push to your fork:
```bash
git push origin feature/my-feature
```

3. Create a Pull Request on GitHub with:
   - Clear title describing the change
   - Description of what changed and why
   - Reference to any related issues (`Fixes #123`)
   - Screenshots for UI changes
   - Checklist of verification steps

4. Ensure all CI checks pass:
   - Tests pass
   - Linting passes
   - Build succeeds

### Review Process

- At least one maintainer will review your PR
- Address any requested changes
- Once approved, a maintainer will merge your PR

## Performance Considerations

When contributing, keep these performance guidelines in mind:

- **Streaming analysis** — Process files as streams, not in memory all at once
- **Lazy evaluation** — Don't compute results until needed
- **Efficient algorithms** — Use optimal data structures for the task
- **Benchmark changes** — Test performance impact on large projects

```bash
# Run performance benchmarks
npm run benchmark
```

## Documentation

### Code Comments
- Use JSDoc for functions and complex logic
- Keep comments concise and accurate
- Update comments when code changes

```javascript
/**
 * Analyzes CSS file for unused selectors
 * @param {string} filePath - Path to CSS file
 * @param {Array<string>} usedSelectors - List of selectors in use
 * @returns {Object} Analysis results with unused selectors
 */
function analyzeCss(filePath, usedSelectors) {
  // implementation
}
```

### README Updates
- Update README.md for user-facing changes
- Add examples for new features
- Keep documentation current with code

### Wiki/Guides
- Document complex features in the Wiki
- Provide architecture documentation
- Create troubleshooting guides

## Release Process

Maintainers follow this process for releases:

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create a GitHub release with tag
4. Publish to npm registry

## Questions?

- Open an issue for clarification
- Check existing issues and discussions
- Join our community discussions

## Recognition

Contributors will be recognized in:
- README.md (for significant contributions)
- GitHub release notes
- CONTRIBUTORS.md file

Thank you for helping make Asset Sweep better! 🎉
