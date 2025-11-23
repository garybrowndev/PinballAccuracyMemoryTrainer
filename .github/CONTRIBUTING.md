# Contributing to Pinball Accuracy Memory Trainer

First off, thank you for considering contributing to the Pinball Accuracy Memory Trainer! It's people like you that make this tool better for the pinball community.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

* **Use a clear and descriptive title** for the issue
* **Describe the exact steps to reproduce the problem** in as much detail as possible
* **Provide specific examples** to demonstrate the steps
* **Describe the behavior you observed** and what you expected to see
* **Include screenshots** if relevant
* **Note your browser and version** as this is a web application

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title** for the suggestion
* **Provide a detailed description** of the suggested enhancement
* **Explain why this enhancement would be useful** to most users
* **List any alternative solutions** you've considered

### Pull Requests

* Fill in the pull request template
* Follow the coding style used throughout the project
* Include screenshots for UI changes
* Update documentation as needed
* Ensure your changes don't break existing functionality

## Development Process

### Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/PinballAccuracyMemoryTrainer.git
   ```
3. Create a new branch from `master`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. Install dependencies:
   ```bash
   npm install
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

### Code Style

This project uses ESLint to maintain code quality and consistency. Before submitting:

* Run the linter:
  ```bash
  npm run lint
  ```
* Fix any linting errors or warnings
* Follow the existing code style and conventions

### Building

Before submitting your pull request:

* Build the project to ensure there are no build errors:
  ```bash
  npm run build
  ```
* Test the production build locally

### Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Reference issues and pull requests liberally after the first line
* Consider using conventional commits format:
  * `feat:` for new features
  * `fix:` for bug fixes
  * `docs:` for documentation changes
  * `style:` for formatting changes
  * `refactor:` for code refactoring
  * `test:` for adding tests
  * `chore:` for maintenance tasks

### Project Structure

* **Single File Architecture**: The main application is in `src/app.jsx` (~2500+ lines)
* **Minimal Changes**: Make the smallest possible changes to achieve your goal
* **No Unnecessary Refactoring**: Avoid large-scale refactoring unless specifically needed
* **Review Custom Instructions**: See `.github/copilot-instructions.md` for detailed architectural guidelines

### Key Development Guidelines

* **Preserve existing patterns**: Follow the established patterns in `src/app.jsx`
* **Maintain percent logic**: All percentage values must be multiples of 5 (enforced by `snap5` helper)
* **Ordering constraints**: Left flipper values must be strictly increasing, right flipper strictly decreasing
* **LocalStorage**: Use the `useLocalStorage` hook pattern for state persistence
* **No new dependencies**: Only add new libraries if absolutely necessary
* **Incremental changes**: Make small, focused changes that can be easily reviewed

### Testing

Currently, there is no automated test infrastructure. When adding features:

* Manually test your changes thoroughly
* Test in multiple browsers if possible
* Verify that existing functionality still works
* Check that data persists correctly in localStorage
* Test the fullscreen overlay if you've made UI changes

## Additional Notes

### Architecture

This project uses a single-file React application architecture with:

* React + Vite for the build system
* Tailwind CSS for styling (utility classes)
* No external state management libraries
* All state managed through React hooks
* LocalStorage for persistence

### AI-Generated Code

This project is an experiment in AI-assisted development. All code has been written by AI with human guidance. When contributing:

* Feel free to use AI tools to help write your code
* Ensure the final output meets the project's quality standards
* Test thoroughly, as AI-generated code may have subtle issues

## Questions?

Feel free to open an issue with your question, or reach out to the project maintainers.

Thank you for contributing! 🎯🎮
