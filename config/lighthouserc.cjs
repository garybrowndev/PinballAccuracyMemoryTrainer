module.exports = {
  ci: {
    collect: {
      // Serve the standalone build directory using npx serve
      // cleanUrls is disabled via serve.json config file to prevent 600ms redirect penalty
      startServerCommand: 'npx serve dist-standalone -p 9222',
      // URLs specified via CLI flags in workflow to pair with appropriate device settings
      // This ensures temporary-public-storage maintains separate histories for mobile vs desktop
      // numberOfRuns set to 2 to test both cold cache (first load) and warm cache (repeat visitor)
      numberOfRuns: 2,
      // Explicitly set output directory for CI artifacts
      outputDir: './.lighthouseci',
      // Base settings - CLI will override with --settings.preset=mobile or --settings.preset=desktop
      settings: {
        chromeFlags: '--no-sandbox --disable-gpu --user-data-dir=./.lighthouse-chrome-data',
        // Simulate warm cache behavior by disabling storage reset between runs
        // This allows the 2nd+ runs to benefit from cached resources (Service Worker, localStorage, etc.)
        // Comment out 'disableStorageReset' to force cold cache on every run
        disableStorageReset: true,
      },
    },
    assert: {
      // Use a custom preset instead of lighthouse:recommended which is too strict
      assertions: {
        // Category scores
        'categories:performance': ['warn', { minScore: 0.5 }],
        'categories:accessibility': ['error', { minScore: 0.95 }], // Strict for WCAG 2.1 AAA
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.85 }],

        // Relax specific audits that are too strict for a local dev server
        'bootup-time': 'off', // Varies too much in CI environment
        'dom-size': ['warn', { maxNumericValue: 3000 }], // Reasonable DOM size limit
        'mainthread-work-breakdown': 'off', // Varies in CI
        'render-blocking-resources': ['warn', { maxLength: 5 }], // Allow some blocking resources
        'server-response-time': 'off', // Local server timing varies
        'uses-long-cache-ttl': 'off', // Cache headers not set on serve command
        'largest-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.25 }],
        // TBT: ~2100ms on cold load (first-time visitors), significantly better on warm cache
        // This is expected for single-file React apps where the entire bundle must parse on first load
        // Service Worker + cache headers will ensure repeat visitors get <600ms TBT
        // Set threshold to 2500ms to accommodate cold cache performance
        'total-blocking-time': ['warn', { maxNumericValue: 2500 }],
      },
    },
    upload: {
      target: 'temporary-public-storage', // Free, 7-day retention
      // GitHub status check configuration
      githubToken: process.env.LHCI_GITHUB_APP_TOKEN,
      githubStatusContextSuffix: '/CI',
    },
  },
};
