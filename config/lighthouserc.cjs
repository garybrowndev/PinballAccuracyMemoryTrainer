/* eslint-env node */
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npx serve dist -p 9222',
      url: ['http://localhost:9222'],
      numberOfRuns: 3, // Run 3 times and average for consistency
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        'categories:performance': ['warn', { minScore: 0.5 }],
        'categories:accessibility': ['error', { minScore: 0.95 }], // Strict for WCAG 2.1 AAA
        'categories:best-practices': ['warn', { minScore: 0.95 }],
        'categories:seo': ['warn', { minScore: 0.85 }],
      },
    },
    upload: {
      target: 'temporary-public-storage', // Free, 7-day retention
    },
  },
};
