# CI/CD & Automation Guide

This document describes all automated workflows and CI/CD processes for the Pinball Accuracy Memory Trainer project.

## 🚀 Automated Workflows

### Code Quality & Testing

#### 1. **PR Validation** (`.github/workflows/ci-pr-validation.yml`)

Runs on every pull request to ensure code quality and functionality.

**Checks:**

- ✅ Linting (ESLint)
- ✅ Formatting (Prettier)
- ✅ Unit tests (Vitest)
- ✅ E2E tests (Playwright)
- ✅ Accessibility tests (axe-core, jest-axe)
- ✅ OWASP dependency check (security vulnerabilities)
- ✅ Lighthouse performance audit
- ✅ Build verification

**Thresholds:**

- Lighthouse Performance: ≥90%
- Lighthouse Accessibility: ≥95%
- Lighthouse Best Practices: ≥90%
- Lighthouse SEO: ≥90%
- CVSS Score: Fails on 7+

#### 2. **Browser Compatibility** (`.github/workflows/browser-compatibility.yml`)

Tests application across multiple browsers.

**Browsers tested:**

- Chromium (Chrome/Edge)
- Firefox
- WebKit (Safari)

**What it does:**

- Runs full E2E test suite on each browser
- Uploads test results as artifacts
- Reports failures per browser

#### 3. **Visual Regression** (`.github/workflows/ci-visual-regression-tests.yml`)

Detects unintended visual changes.

**Screenshots captured:**

- Homepage (light & dark mode)
- Setup screen
- Preset dropdown
- Practice mode
- Recall mode
- Mobile viewport (375x667)
- Tablet viewport (768x1024)
- Desktop viewport (1920x1080)

**Update baseline:**

```bash
npm run test:e2e:visual:update
```

### Security

#### 4. **OWASP Dependency Check** (`.github/workflows/owasp-dependency-check.yml`)

Scans for vulnerable dependencies.

**Schedule:**

- On every PR
- Weekly (Sunday at midnight)

**Actions:**

- Uploads SARIF report to GitHub Security
- Fails on CVSS 7+ vulnerabilities

#### 5. **Security Headers** (`.github/workflows/security-headers.yml`)

Validates security headers in production build.

**Checks:**

- Content-Security-Policy
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection
- No inline event handlers

#### 6. **CodeQL Analysis** (`.github/workflows/security-codeql-security-analysis.yml`)

Static code analysis for security vulnerabilities.

**Languages:** JavaScript, TypeScript

### Performance & Optimization

#### 7. **Bundle Size Tracking** (`.github/workflows/bundle-size.yml`)

Monitors bundle size on every PR and push.

**Thresholds:**

- ⚠️ Warning: Main JS > 200 KB
- ⚠️ Warning: CSS > 50 KB
- ⚠️ Warning: Total dist > 2 MB
- ❌ Fail: Main JS > 500 KB

**Reports:**

- Total dist size
- Main JS bundle size
- Main CSS bundle size
- Total asset count

#### 8. **Performance Regression** (`.github/workflows/performance-regression.yml`)

Detects performance regressions using Lighthouse.

**Metrics monitored:**

- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Time to Interactive (TTI)
- Total Blocking Time (TBT)
- Cumulative Layout Shift (CLS)

### Release & Documentation

#### 9. **Generate Release Notes** (`.github/workflows/generate-release-notes.yml`)

Automatically generates release notes from commit history.

**Trigger:** When a release is published

**Categories:**

- ✨ New Features
- 🐛 Bug Fixes
- ⚡ Performance Improvements
- 📚 Documentation
- ♻️ Code Refactoring
- 🧪 Tests
- 🔧 Chores

**Statistics included:**

- Total commits
- Contributors
- Files changed

#### 10. **Update CHANGELOG** (`.github/workflows/automation-update-changelog.yml`)

Maintains CHANGELOG.md automatically.

**Format:** [Keep a Changelog](https://keepachangelog.com/)

**Sections:**

- ⚠️ BREAKING CHANGES
- Added (new features)
- Fixed (bug fixes)
- Performance
- Changed (refactoring)
- Documentation
- Tests
- Maintenance

#### 11. **Auto Version & Release** (`.github/workflows/cd-release.yml`)

Automated versioning using Semantic Release.

**Version bumps:**

- `feat:` → Minor version
- `fix:` → Patch version
- `BREAKING CHANGE:` → Major version

### Deployment

#### 12. **PR Preview Deployment** (`.github/workflows/cd-deploy-pr-preview.yml`)

Deploys preview builds for every PR.

**What it does:**

- Builds production version
- Deploys to unique URL: `pinball-trainer-pr-{number}.surge.sh`
- Comments preview URL on PR
- Updates on each new commit

**Testing checklist provided:**

- Dark mode toggle
- Preset loading
- Practice mode
- Recall mode
- PWA install prompt
- Offline functionality

### Maintenance

#### 13. **Dependency Review** (`.github/workflows/security-dependency-review.yml`)

Reviews dependency changes in PRs.

**Checks:**

- License compatibility
- Known vulnerabilities
- Deprecated packages

#### 14. **Stale Issues/PRs** (`.github/workflows/automation-mark-stale-issues-and-prs.yml`)

Manages stale issues and pull requests.

**Timeline:**

- Mark stale after 60 days of inactivity
- Close after 7 days of being marked stale

## 📊 Artifact Retention

| Artifact           | Retention | Purpose              |
| ------------------ | --------- | -------------------- |
| Test results       | 7 days    | E2E test debugging   |
| Lighthouse reports | 30 days   | Performance tracking |
| OWASP reports      | 30 days   | Security audit trail |
| Visual regression  | 14 days   | Visual diff review   |
| Visual baseline    | 90 days   | Screenshot baseline  |
| Release notes      | 90 days   | Documentation        |

## 🔧 Local Development Commands

### Testing

```bash
# Run all tests
npm test

# Unit tests
npm run test:run
npm run test:coverage

# E2E tests
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:debug

# Accessibility tests
npm run test:a11y
npm run test:e2e:a11y

# Visual regression
npm run test:e2e:visual
npm run test:e2e:visual:update  # Update baseline
```

### Code Quality

```bash
# Lint
npm run lint

# Format
npm run format
npm run format:check

# Build
npm run build
npm run build:standalone
```

### Other

```bash
# Generate sitemap
npm run sitemap

# Analyze bundle
npm run analyze
```

## 🚦 PR Merge Requirements

Before a PR can be merged to master:

1. ✅ All status checks must pass
2. ✅ Code review approval required
3. ✅ Branch must be up to date
4. ✅ No merge conflicts
5. ✅ All conversations resolved

## 🎯 Performance Budgets

| Metric                   | Budget   | Current |
| ------------------------ | -------- | ------- |
| Main JS bundle           | < 200 KB | ~150 KB |
| CSS bundle               | < 50 KB  | ~30 KB  |
| Total dist size          | < 2 MB   | ~1.2 MB |
| Lighthouse Performance   | ≥ 90     | 95+     |
| Lighthouse Accessibility | ≥ 95     | 98+     |

## 🔐 Required Secrets

For full CI/CD functionality, configure these secrets:

| Secret         | Purpose                | Required For    |
| -------------- | ---------------------- | --------------- |
| `SURGE_TOKEN`  | PR preview deployments | Optional        |
| `GITHUB_TOKEN` | Automated workflows    | Auto-configured |

## 📝 Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject

body

footer
```

**Types:**

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring
- `perf:` Performance improvement
- `test:` Tests
- `chore:` Maintenance

**Examples:**

```bash
feat: add PWA install prompt
fix: correct dark mode transition
docs: update CI/CD guide
perf: optimize bundle size
```

## 🐛 Troubleshooting

### Workflow failing?

1. Check workflow logs in GitHub Actions
2. Run tests locally to reproduce
3. Verify Node.js version matches `.nvmrc`
4. Clear npm cache: `npm cache clean --force`

### Bundle size exceeded?

1. Check what changed: `npm run analyze`
2. Review imported dependencies
3. Use dynamic imports for large modules
4. Remove unused dependencies

### Visual regression failed?

1. Download artifacts to review screenshots
2. If intentional, update baseline: `npm run test:e2e:visual:update`
3. Commit updated screenshots
4. If unintentional, fix CSS/layout issues

### Security scan failed?

1. Check SARIF report in GitHub Security tab
2. Update vulnerable dependencies: `npm audit fix`
3. Check for breaking changes
4. Run tests after updates

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Playwright Documentation](https://playwright.dev/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [OWASP Dependency Check](https://owasp.org/www-project-dependency-check/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Keep a Changelog](https://keepachangelog.com/)
