#!/usr/bin/env node
/**
 * Lighthouse Metadata Extractor - extracts scores and URLs from Lighthouse CI results.
 *
 * Usage: node scripts/lighthouse-metadata.cjs <device> [uploadLogFile] [outputDir]
 */

const fs = require('fs');
const path = require('path');

const device = process.argv[2];
const uploadLogFile = process.argv[3];
const outputDir = process.argv[4] || device;

if (!device || !['mobile', 'desktop'].includes(device)) {
  // eslint-disable-next-line no-console -- CLI script needs console output
  console.error('Usage: node scripts/lighthouse-metadata.cjs <device> [uploadLogFile] [outputDir]');
  // eslint-disable-next-line no-console -- CLI script needs console output
  console.error('  device: "mobile" or "desktop"');
  // eslint-disable-next-line no-console -- CLI script needs console output
  console.error('  uploadLogFile: optional log file from lhci upload');
  // eslint-disable-next-line no-console -- CLI script needs console output
  console.error('  outputDir: optional directory name (defaults to device name)');
  process.exit(1);
}

// Parse report URLs from upload log if provided
let comparisonReportUrl = null;
let directReportUrl = null;

if (uploadLogFile) {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path from CLI arg
    let logContent = fs.readFileSync(uploadLogFile, 'utf8');

    // Remove BOM if present (can happen with some file encodings)
    logContent = logContent.replace(/^\uFEFF/, '');

    // Extract report URL - match URL after "Open the report at" (from lhci upload)
    const reportMatch = /open the report at\s+(https?:\/\/\S+)/i.exec(logContent);
    if (reportMatch) {
      const reportUrl = reportMatch[1];

      // Check if this is a comparison viewer URL or a direct report URL
      // Comparison URL format: https://googlechrome.github.io/lighthouse-ci/viewer/?...&compareReport=...
      // Direct URL format: https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/...
      const compareReportMatch = /[&?]comparereport=(https?%3a%2f%2f[^&]+)/i.exec(reportUrl);
      if (compareReportMatch) {
        // It's a comparison viewer URL - extract both URLs
        comparisonReportUrl = reportUrl;
        directReportUrl = decodeURIComponent(compareReportMatch[1]);
      } else if (/^https:\/\/storage\.googleapis\.com\/.*\/reports\//i.test(reportUrl)) {
        // It's a direct report URL - use it as the direct report
        directReportUrl = reportUrl;
        // No comparison URL available for this case
        comparisonReportUrl = null;
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console -- CLI script needs console output
    console.error(`Warning: Could not read upload log file: ${error.message}`);
  }
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

  // Add report URLs if available
  if (comparisonReportUrl) {
    metadata.comparisonReportUrl = comparisonReportUrl;
  }
  if (directReportUrl) {
    metadata.directReportUrl = directReportUrl;
  }

  // Output as JSON
  // eslint-disable-next-line no-console -- CLI script needs console output
  console.log(JSON.stringify(metadata, null, 2));
} catch (error) {
  // eslint-disable-next-line no-console -- CLI script needs console output
  console.error('ERROR: Failed to parse manifest:', error.message);
  process.exit(1);
}
