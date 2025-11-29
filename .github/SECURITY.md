# Security Policy

## Supported Versions

Only the latest version of Pinball Accuracy Memory Trainer is supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| Older   | :x:                |

## Security Model

Pinball Accuracy Memory Trainer is a **client-side only** web application with the following security characteristics:

- **No server-side components** — The app runs entirely in your browser
- **No data collection** — We don't collect, transmit, or store any user data on external servers
- **Local storage only** — All your data (presets, scores, settings) is stored in your browser's local storage
- **No authentication** — No accounts, passwords, or personal information required
- **No external API calls** — The app works 100% offline after initial load
- **No cookies** — We don't use tracking cookies or analytics

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Please use GitHub Security Advisories to report vulnerabilities privately:**

1. Go to the [Security tab](https://github.com/garybrowndev/PinballAccuracyMemoryTrainer/security) of this repository
2. Click **"Report a vulnerability"**
3. Fill out the form with details about the vulnerability

This ensures the vulnerability is kept private until a fix is available.

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

### What to Expect

- We will acknowledge your report as soon as possible
- We will investigate and work on a fix
- We will credit you in the fix (unless you prefer to remain anonymous)
- We will notify you when the fix is released

### Please Don't

- Open public issues for security vulnerabilities
- Exploit vulnerabilities beyond what's necessary to demonstrate them
- Share vulnerability details before a fix is available

## Scope

Given the client-side nature of this application, relevant security concerns include:

- Cross-site scripting (XSS) vulnerabilities
- Malicious preset files that could execute code
- Dependencies with known vulnerabilities
- Local storage manipulation attacks

## Thank You

Thank you for helping keep Pinball Accuracy Memory Trainer safe for everyone! 🎯
