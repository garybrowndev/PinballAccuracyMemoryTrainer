#!/usr/bin/env node
/**
 * Lighthouse Metadata Extractor
 *
 * Extracts Lighthouse results from .lighthouseci directory and outputs
 * structured metadata for use in workflow summaries and PR comments.
 *
 * Usage:
 * node scripts/lighthouse-metadata.cjs <device> [outputDir]
 *
 * Arguments:
 * device - Device type: 'mobile' or 'desktop'
 * outputDir - Optional: Custom .lighthouseci subdirectory (e.g., 'surge-mobile')
 *
 * Output: JSON to stdout with structure:
 * { device: "mobile", url: "http://localhost:9222/...", scores: { ... } }
 */

const fs = require('fs');
const path = require('path');

const device = process.argv[2];
const outputDir = process.argv[3] || device;

if (!device || !['mobile', 'desktop'].includes(device)) {
  // eslint-disable-next-line no-console -- CLI script needs console output
  console.error('Usage: node scripts/lighthouse-metadata.cjs <device> [outputDir]');
  // eslint-disable-next-line no-console -- CLI script needs console output
  console.error('  device: "mobile" or "desktop"');
  // eslint-disable-next-line no-console -- CLI script needs console output
  console.error('  outputDir: optional custom directory (defaults to device name)');
  process.exit(1);
}

const manifestPath = path.join(process.cwd(), '.lighthouseci', outputDir, 'manifest.json');

// eslint-disable-next-line security/detect-non-literal-fs-filename -- Path constructed from validated CLI args
if (!fs.existsSync(manifestPath)) {
  // eslint-disable-next-line no-console -- CLI script needs console output
  console.error(`ERROR: Manifest file not found at ${manifestPath}`);
  // eslint-disable-next-line no-console -- CLI script needs console output
  console.error('Make sure Lighthouse has run and saved results to filesystem');
  process.exit(1);
}

try {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path constructed from validated CLI args
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // Find the representative (median) run
  const representativeRun = manifest.find((run) => run.isRepresentativeRun) || manifest[0];

  if (!representativeRun) {
    // eslint-disable-next-line no-console -- CLI script needs console output
    console.error('ERROR: No representative run found in manifest');
    process.exit(1);
  }

  // Extract category scores
  const { summary, url, htmlPath, jsonPath } = representativeRun;
  const metadata = {
    device,
    url,
    scores: {
      performance: summary.performance || 0,
      accessibility: summary.accessibility || 0,
      bestPractices: summary['best-practices'] || 0,
      seo: summary.seo || 0,
    },
    reportPath: htmlPath,
    jsonPath,
  };

  // Output as JSON
  // eslint-disable-next-line no-console -- CLI script needs console output
  console.log(JSON.stringify(metadata, null, 2));
} catch (error) {
  // eslint-disable-next-line no-console -- CLI script needs console output
  console.error('ERROR: Failed to parse manifest:', error.message);
  process.exit(1);
}
