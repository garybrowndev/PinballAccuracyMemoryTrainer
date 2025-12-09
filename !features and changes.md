Provide an "undo" feature

There needs to be significantly different scoring after the first time you guess the shot, and the second time you guess it. It may be that the first time you don't even count and you only start scoring until you get to the second time that shot happens to be selected

Add an ability to make a shot "not possible anymore", maybe something like after hitting a shot X times, it becomes not possible, but on some randomness after that in a range of shots?

Performance Monitoring & Real User Metrics
Missing: Real-world performance tracking

Add: Web Vitals monitoring (CLS, FID, LCP, TTFB)
Add: Error tracking (Sentry or similar, privacy-friendly)
Add: Performance budgets in Lighthouse CI (you have basic setup but could be stricter)
Add: Browser-based benchmarking for critical paths
Consider: Adding performance.mark() and performance.measure() for key operations

Developer Experience - Better Tooling
Missing/Could Improve:

Type Safety: Migrate to TypeScript (you have @types packages installed but using JSX)
Start with JSDoc comments for type hints
Gradual migration to .tsx
VSCode workspace settings: Share recommended extensions via .vscode/extensions.json
Better error boundaries: Add React error boundaries for graceful failure
Hot Module Replacement: Ensure HMR works optimally for the large app.jsx file
Source maps: Verify production source maps for easier debugging

Go through entire repo and all settings and look for things that are disabled and list them. For example, I know there are at least a few lint things that are disbale dand maybe some tests that are skipped. i want to go back and make all those work.

Look for other random errors at the end of workflow jobs

Name workflows better to make sense

Lighthouse looks to be still errorcode 1

Review lighthouse results, their seemed to be lots of errors
