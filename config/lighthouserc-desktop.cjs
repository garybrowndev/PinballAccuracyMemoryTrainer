module.exports = {
  ci: {
    collect: {
      // Serve the standalone build directory using npx serve
      // cleanUrls is disabled via serve.json config file to prevent 600ms redirect penalty
      startServerCommand: 'bash -c "npx serve dist-standalone -p 9222 & sleep 2; echo ready"',
      url: 'http://localhost:9222/pinball-trainer-standalone-desktop.html',
      // numberOfRuns set to 2 to test both cold cache (first load) and warm cache (repeat visitor)
      numberOfRuns: 2,
      // Explicitly set output directory for CI artifacts
      outputDir: './.lighthouseci-desktop',
      // Desktop-specific settings
      settings: {
        chromeFlags: '--no-sandbox --disable-gpu --user-data-dir=./.lighthouse-chrome-data',
        // Disable storage reset to preserve warm cache behavior (Service Worker, localStorage, etc.)
        // This matches repeat visitor scenarios and maintains consistency with baselines
        disableStorageReset: true,
        // Desktop device emulation
        emulatedFormFactor: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
        },
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false,
        },
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
      // Force baseline creation for PR branches
      uploadUrlMap: true,
    },
  },
};
