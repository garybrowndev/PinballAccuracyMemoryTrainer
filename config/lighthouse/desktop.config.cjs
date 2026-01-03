module.exports = {
  ci: {
    collect: {
      // Serve the standalone build directory using npx serve
      // cleanUrls is disabled via serve.json config file to prevent 600ms redirect penalty
      startServerCommand: 'npx serve dist-standalone -p 9222',
      // Use different URL path for desktop to enable distinct comparisons in temp storage
      url: ['http://localhost:9222/pinball-trainer-standalone-desktop.html'],
      numberOfRuns: 3, // Run 3 times for reliable median
      outputDir: './.lighthouseci',
      settings: {
        // Desktop emulation settings
        preset: 'desktop',
        // Keep warm cache to simulate real-world usage
        disableStorageReset: true,
        // Chrome flags optimized for Windows stability and temp file cleanup
        chromeFlags:
          '--no-sandbox --disable-gpu --disable-dev-shm-usage --disable-software-rasterizer --disable-extensions',
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
      githubToken: process.env.GITHUB_TOKEN,
      githubStatusContextSuffix: '/Desktop',
    },
  },
};
