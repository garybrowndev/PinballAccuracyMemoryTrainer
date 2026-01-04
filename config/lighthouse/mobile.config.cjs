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

        // Strict audit requirements
        'bootup-time': ['error', { maxNumericValue: 3500 }],
        'mainthread-work-breakdown': ['error', { maxNumericValue: 3500 }],
        'server-response-time': ['error', { maxNumericValue: 600 }],
        'uses-long-cache-ttl': 'off',

        // Strict performance and quality bounds
        'dom-size': 'off',
        'render-blocking-resources': 'off',
        'largest-contentful-paint': ['error', { maxNumericValue: 3500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
      githubToken: process.env.GITHUB_TOKEN,
      githubStatusContextSuffix: '/Mobile',
    },
  },
};
