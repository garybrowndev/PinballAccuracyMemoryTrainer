module.exports = {
  ci: {
    collect: {
      // Serve the standalone build directory using npx serve
      // cleanUrls is disabled via serve.json config file to prevent 600ms redirect penalty
      startServerCommand: 'npx serve dist-standalone -p 9222',
      startServerReadyPattern: 'accepting connections|listening',
      startServerReadyTimeout: 30000,
      url: ['http://localhost:9222/pinball-trainer-standalone.html'],
      numberOfRuns: 3,
      settings: {
        // Mobile emulation settings (default Lighthouse behavior)
        // Keep warm cache to simulate real-world usage
        disableStorageReset: true,
        maxWaitForLoad: 90000,
      },
    },
    assert: {
      assertions: {
        // Performance category - 80% threshold
        'categories:performance': ['error', { minScore: 0.8 }],
        // Accessibility category - strict
        'categories:accessibility': ['error', { minScore: 0.8 }],
        // Best practices category
        'categories:best-practices': ['error', { minScore: 0.8 }],
        // SEO category
        'categories:seo': ['error', { minScore: 0.8 }],

        // Disable flaky audits that vary in CI environment
        'bootup-time': 'off',
        'mainthread-work-breakdown': 'off',
        'server-response-time': 'off',
        'uses-long-cache-ttl': 'off',

        // Relax specific audits with reasonable bounds
        'dom-size': ['warn', { maxNumericValue: 3000 }],
        'render-blocking-resources': ['warn', { maxLength: 5 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.25 }],
        'total-blocking-time': ['warn', { maxNumericValue: 600 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
      outputDir: '.lighthouseci/mobile',
      githubToken: process.env.GITHUB_TOKEN,
      githubStatusContextSuffix: '/Mobile',
    },
  },
};
