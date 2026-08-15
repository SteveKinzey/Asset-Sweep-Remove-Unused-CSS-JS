---
name: Bug Report
about: Create a report to help us improve
title: "[BUG] "
labels: bug
assignees: ''

---

## Description
A clear and concise description of what the bug is.

## Reproduction Steps
Steps to reproduce the behavior:
1. Run command with '...'
2. Use configuration '...'
3. See error

## Expected Behavior
A clear and concise description of what you expected to happen.

## Actual Behavior
What actually happened instead.

## Screenshots/Output
If applicable, add screenshots or paste error output:
```
Error message here
```

## Environment
- **Asset Sweep Version:** (e.g., 1.0.0)
- **Node Version:** (output of `node --version`)
- **npm/yarn Version:** (output of `npm --version` or `yarn --version`)
- **Operating System:** (Windows/Mac/Linux)
- **Project Type:** (React/Vue/Vanilla/Other)

## Configuration
If applicable, provide your .asset-sweeprc.json or relevant configuration:
```json
{
  "include": ["src/**/*.{html,js,css}"]
}
```

## Minimal Reproduction
If possible, provide a minimal example that reproduces the issue:
```bash
# Commands to run
asset-sweep scan ./example
```

## Additional Context
Add any other context about the problem here.

## Checklist
- [ ] I have searched existing issues and discussions
- [ ] I have provided a minimal reproduction case
- [ ] I am using the latest version of Asset Sweep
- [ ] This is not a duplicate of an existing issue
