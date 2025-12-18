# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by:

1. **Email**: Send details to the repository owner
2. **GitHub Security Advisories**: Use the "Security" tab to privately report vulnerabilities
3. **Do NOT** create a public issue for security vulnerabilities

### What to include in your report:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### What to expect:

- Acknowledgment within 48 hours
- Regular updates on progress
- Credit in the security advisory (if desired)

## Security Measures

This project implements:

- ✅ **Strict Content Security Policy (CSP)** - Prevents XSS attacks
- ✅ **OWASP Dependency Check** - Scans for vulnerable dependencies
- ✅ **Automated Security Headers** - X-Frame-Options, X-Content-Type-Options, etc.
- ✅ **Secure localStorage** - XSS prevention and sanitization
- ✅ **GitHub Secret Scanning** - Detects accidentally committed secrets
- ✅ **Dependabot** - Automated dependency updates
- ✅ **CodeQL Analysis** - Static code analysis for security issues
- ✅ **WCAG 2.1 AAA Accessibility** - Inclusive and secure user experience

## OpenSSF Best Practices

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/10230/badge)](https://www.bestpractices.dev/projects/10230)

This project follows the [OpenSSF Best Practices](https://www.bestpractices.dev/) guidelines for secure open source software development. We are committed to:

- **Security Best Practices**: Following industry standards for secure development
- **Vulnerability Reporting**: Clear process for reporting and addressing security issues
- **Continuous Improvement**: Regular security audits and updates
- **Transparency**: Open security policies and documented practices

For more information about our security practices, see our [OpenSSF Best Practices page](https://www.bestpractices.dev/projects/10230).

## localStorage Security

All localStorage operations use sanitized wrappers that:

- Whitelist allowed keys
- Sanitize data to prevent XSS
- Validate data size limits
- Handle errors gracefully

See `src/utils/secureStorage.js` for implementation.

## Dependency Management

- Dependencies are scanned on every PR
- Automated updates via Dependabot
- CVSS 7+ vulnerabilities block builds
- Regular security audits

## Best Practices for Contributors

1. Never commit secrets, API keys, or credentials
2. Use the secure storage utilities for localStorage operations
3. Follow CSP guidelines (no inline scripts)
4. Sanitize all user inputs
5. Keep dependencies up to date
6. Run security tests before submitting PRs

## Security Testing

Run security tests locally:

```bash
npm run lint                 # Code quality and security lint rules
npm run test:run            # Unit tests including security tests
npm audit --audit-level=low # Check for vulnerable dependencies (strictest level)
```

## Contact

For security concerns, contact the maintainer through GitHub.
