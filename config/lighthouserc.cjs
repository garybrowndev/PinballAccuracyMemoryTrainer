module.exports = {
  ci: {
    collect: {
      // Serve the standalone build directory using npx serve
      // cleanUrls is disabled via serve.json config file to prevent 600ms redirect penalty
      startServerCommand: 'npx serve dist-standalone -p 9222',
      url: ['http://localhost:9222/pinball-trainer-standalone.html'],
      numberOfRuns: 1, // Single run for each form factor (mobile and desktop)
      // Explicitly set output directory for CI artifacts
      outputDir: './.lighthouseci',
      // Enable HTML reports
      settings: [
        // Mobile emulation (default Lighthouse mobile settings)
        {
          chromeFlags: '--no-sandbox --disable-gpu --user-data-dir=./.lighthouse-chrome-data',
          emulatedFormFactor: 'mobile',
          throttling: {
            rttMs: 150,
            throughputKbps: 1638.4,
            cpuSlowdownMultiplier: 4,
          },
          screenEmulation: {
            mobile: true,
            width: 412,
            height: 823,
            deviceScaleFactor: 2.625,
            disabled: false,
          },
        },
        // Desktop emulation
        {
          chromeFlags: '--no-sandbox --disable-gpu --user-data-dir=./.lighthouse-chrome-data',
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
      ],
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
        'total-blocking-time': ['warn', { maxNumericValue: 600 }],
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
