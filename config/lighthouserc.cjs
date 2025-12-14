module.exports = {
  ci: {
    collect: {
      // Serve the standalone build directory (contains single HTML file)
      startServerCommand:
        'mkdir -p lighthouse-test && cp dist-standalone/pinball-trainer-standalone.html lighthouse-test/index.html && npx serve lighthouse-test -p 9222',
      url: ['http://localhost:9222'],
      numberOfRuns: 3, // Run 3 times and average for consistency
      settings: {
        // Add a longer timeout for server startup
        chromeFlags: '--no-sandbox --disable-gpu',
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
        'total-blocking-time': ['warn', { maxNumericValue: 600 }],
      },
    },
    upload: {
      target: 'temporary-public-storage', // Free, 7-day retention
      githubAppToken: process.env.LHCI_GITHUB_APP_TOKEN, // Optional: for status checks
    },
  },
};
