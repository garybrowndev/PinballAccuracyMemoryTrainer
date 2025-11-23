# Contributing to Pinball Accuracy Memory Trainer

Thank you for your interest in contributing to the Pinball Accuracy Memory Trainer! This project aims to help pinball players improve their shot accuracy recall through progressive training.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Pull Requests](#pull-requests)
- [Development Setup](#development-setup)
- [Style Guidelines](#style-guidelines)
  - [Git Commit Messages](#git-commit-messages)
  - [Code Style](#code-style)
- [Project Architecture](#project-architecture)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples** (e.g., screenshots, browser console logs)
- **Describe the behavior you observed** and what you expected
- **Include your browser version and operating system**
- **Mention if the problem can be reliably reproduced**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description** of the suggested enhancement
- **Explain why this enhancement would be useful** to most users
- **List any similar features** in other applications if applicable

### Pull Requests

1. Fork the repository and create your branch from `master`
2. Follow the naming convention for branches (e.g., `feature/new-feature`, `fix/bug-fix`, `chore/maintenance`)
3. Make your changes following the [style guidelines](#style-guidelines)
4. Test your changes thoroughly
5. Update documentation if needed
6. Ensure your code lints without errors (`npm run lint`)
7. Create a pull request with a clear title and description

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/garybrowndev/PinballAccuracyMemoryTrainer.git
   cd PinballAccuracyMemoryTrainer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Run linting**
   ```bash
   npm run lint
   ```

## Style Guidelines

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Start with a type prefix:
  - `feat:` - New features
  - `fix:` - Bug fixes
  - `docs:` - Documentation changes
  - `style:` - Code style changes (formatting, missing semicolons, etc.)
  - `refactor:` - Code refactoring
  - `perf:` - Performance improvements
  - `test:` - Adding or updating tests
  - `chore:` - Maintenance tasks
- Limit the first line to 72 characters or less
- Reference issues and pull requests after the first line

### Code Style

This project follows specific coding conventions outlined in `.github/copilot-instructions.md`. Key points:

- **React & JavaScript**: Follow existing patterns in `src/app.jsx`
- **Styling**: Use Tailwind utility classes
- **State Management**: Use `useLocalStorage` wrapper for persistent state
- **Helper Functions**: Keep them pure and reusable
- **Percent Values**: Always use 5% increments (enforced by `snap5` helper)
- **Comments**: Match existing comment style; only add when necessary for clarity
- **ESLint**: All code must pass linting (`npm run lint`)

## Project Architecture

This is a single-page React application with the following key characteristics:

- **Main Component**: `src/app.jsx` contains the primary application logic (~2500+ lines)
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: Tailwind CSS for utility-first styling
- **State**: LocalStorage for persistence, React hooks for component state
- **No Backend**: Completely client-side, offline-capable application

### Key Architectural Principles

1. **Minimal Changes**: Make surgical, focused changes
2. **Preserve Existing Logic**: Don't refactor working code unnecessarily
3. **Helper Functions**: Reuse existing helpers like `snap5()`, `clamp()`, etc.
4. **Performance**: Use `useMemo` for expensive computations
5. **Testing**: Test changes thoroughly in a browser before submitting

### Important Files

- `src/app.jsx` - Main application component
- `index.html` - Entry HTML file
- `vite.config.js` - Vite configuration
- `eslint.config.js` - ESLint configuration
- `.github/copilot-instructions.md` - Detailed coding guidelines for AI assistants

## Questions?

Feel free to open an issue for questions or discussions about contributing to this project. We appreciate your interest in making this tool better for the pinball community!

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
