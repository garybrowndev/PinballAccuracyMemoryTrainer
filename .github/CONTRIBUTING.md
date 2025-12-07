# Contributing to Pinball Accuracy Memory Trainer

First off, thank you for considering contributing to Pinball Accuracy Memory Trainer! 🎯

We welcome contributions from everyone — whether it's fixing bugs, adding new pinball machine presets, improving documentation, or suggesting new features. Every contribution helps make this tool better for the pinball community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Workflow](#development-workflow)
- [Style Guidelines](#style-guidelines)
- [Submitting Changes](#submitting-changes)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- [VS Code](https://code.visualstudio.com/) (recommended)
- [Node.js](https://nodejs.org/) (LTS version recommended)
- Git

### Setup

Getting started is super simple:

1. **Fork & Clone** the repository

   ```bash
   git clone https://github.com/YOUR-USERNAME/PinballAccuracyMemoryTrainer.git
   cd PinballAccuracyMemoryTrainer
   ```

2. **Open in VS Code**

   ```bash
   code .
   ```

3. **Press F5** to start debugging — all dependencies install automatically!

That's it! The development server will start and you can begin making changes.

### Alternative Manual Setup

If you prefer the command line:

```bash
npm install          # Install dependencies
npm run dev          # Start development server
```

## How Can I Contribute?

### 🐛 Reporting Bugs

Found a bug? Please [open an issue](https://github.com/garybrowndev/PinballAccuracyMemoryTrainer/issues/new?template=bug_report.yml) with:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Browser and OS information

### 💡 Suggesting Features

Have an idea? [Open a feature request](https://github.com/garybrowndev/PinballAccuracyMemoryTrainer/issues/new?template=feature_request.yml) and describe:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

### 🎰 Adding Pinball Machine Presets

One of the best ways to contribute! Add presets for pinball machines that aren't yet included:

1. Create a JSON file in `public/presets/` following the existing format
2. Add the machine to `public/presets/index.json`
3. Include accurate shot information and flipper positions
4. Submit a PR with the machine name and manufacturer

### 📝 Improving Documentation

- Fix typos or unclear instructions
- Add examples or clarifications
- Translate documentation

### 🔧 Code Contributions

- Bug fixes
- Performance improvements
- New features
- Test coverage improvements

### 🏷️ Good First Issues

New to the project? Look for issues labeled [`good first issue`](https://github.com/garybrowndev/PinballAccuracyMemoryTrainer/labels/good%20first%20issue) — these are great starting points for first-time contributors!

## Development Workflow

### Branch Naming

Use descriptive branch names:

- `feature/add-twilight-zone-preset`
- `fix/score-calculation-bug`
- `docs/update-readme`

### Running Tests

Before submitting a PR, ensure all tests pass:

```bash
npm run lint         # Check code style
npm run test:run     # Run unit tests
npm run test:e2e     # Run E2E tests
```

Or use VS Code tasks:

- **Run Unit Tests** (Ctrl+Shift+B → select task)
- **Run E2E Tests**
- **Run All Tests**

### Code Coverage

Check test coverage with:

```bash
npm run test:coverage
```

## Style Guidelines

### Code Style

This project uses ESLint with a comprehensive configuration. Your code will be automatically checked:

- Run `npm run lint` to check for issues
- Most issues can be auto-fixed with `npm run lint -- --fix`

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add Twilight Zone pinball preset
fix: correct flipper angle calculation
docs: update installation instructions
test: add tests for score tracking
```

Common prefixes:

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation only
- `test:` — Adding or updating tests
- `refactor:` — Code refactoring
- `style:` — Formatting, no code change
- `chore:` — Maintenance tasks

## Submitting Changes

1. **Create a branch** from `master`
2. **Make your changes** with clear, focused commits
3. **Run tests** — all tests must pass
4. **Push** to your fork
5. **Open a Pull Request** against `master`

### Pull Request Guidelines

- Fill out the PR template completely
- Link any related issues
- Provide screenshots for UI changes
- Keep PRs focused — one feature/fix per PR
- Be responsive to feedback

## Community

### Getting Help

- 📋 [Open an issue](https://github.com/garybrowndev/PinballAccuracyMemoryTrainer/issues/new?template=question.yml) for questions
- 💬 Use [GitHub Discussions](https://github.com/garybrowndev/PinballAccuracyMemoryTrainer/discussions) for general conversation

### Recognition

All contributors are valued! Contributors will be recognized in:

- The project's contributor list
- Release notes when applicable

---

## Thank You! 🙏

Your contributions make Pinball Accuracy Memory Trainer better for pinball enthusiasts everywhere. Whether it's a typo fix or a major feature, every contribution matters.

**Happy flipping! 🎯**
