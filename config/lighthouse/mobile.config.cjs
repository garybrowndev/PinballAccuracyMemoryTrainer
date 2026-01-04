// URL priority: CLI arg (npm run lhci:mobile -- https://...) > env var > localhost default
const urlArg = process.argv.find((arg) => arg.startsWith('http'));
const url =
  urlArg || process.env.LIGHTHOUSE_URL || 'http://localhost:9222/pinball-trainer-standalone.html';
const isExternalUrl = urlArg || process.env.LIGHTHOUSE_URL;
const isSurgeUrl = url.includes('surge.sh');

const collectConfig = {
  url: [url],
  numberOfRuns: 3,
  settings: {
    // Mobile emulation settings (default Lighthouse behavior)
    // Keep warm cache to simulate real-world usage
    disableStorageReset: true,
    maxWaitForLoad: 90000,
  },
};

// Only add startServerCommand for localhost testing
if (!isExternalUrl) {
  collectConfig.startServerCommand = 'npx serve dist-standalone -p 9222';
  collectConfig.startServerReadyPattern = 'accepting connections|listening';
  collectConfig.startServerReadyTimeout = 30000;
}

module.exports = {
  ci: {
    collect: collectConfig,
    assert: {
      assertions: {
        // Performance category - 80% threshold
        'categories:performance': ['error', { minScore: 0.8 }],
        // Accessibility category - strict
        'categories:accessibility': ['error', { minScore: 0.8 }],
        // Best practices category
        'categories:best-practices': ['error', { minScore: 0.8 }],
        // SEO category - relaxed for Surge.sh (canonical URL issues on free tier)
        'categories:seo': ['error', { minScore: isSurgeUrl ? 0.6 : 0.8 }],

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
