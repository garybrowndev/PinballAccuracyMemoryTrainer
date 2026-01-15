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
let reportUrl = null;
let compareUrl = null;

if (uploadLogFile) {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path from CLI arg
    const logContent = fs.readFileSync(uploadLogFile, 'utf8');

    // Extract report URL - match URL after "Open the report at" (from lhci upload)
    const reportMatch = /open the report at\s+(https?:\/\/\S+)/i.exec(logContent);
    if (reportMatch) {
      reportUrl = reportMatch[1];
    }

    // Extract compare URL - match URL after "View the comparison at:" or "Compare URL:"
    // eslint-disable-next-line security/detect-unsafe-regex -- Simple pattern for log parsing
    const compareMatch = /(?:compare|view the comparison at:)\s*(?:url:\s*)?(https?:\/\/\S+)/i.exec(
      logContent
    );
    if (compareMatch) {
      compareUrl = compareMatch[1];
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
  if (reportUrl) {
    metadata.reportUrl = reportUrl;
  }
  if (compareUrl) {
    metadata.compareUrl = compareUrl;
  }

  // Output as JSON
  // eslint-disable-next-line no-console -- CLI script needs console output
  console.log(JSON.stringify(metadata, null, 2));
} catch (error) {
  // eslint-disable-next-line no-console -- CLI script needs console output
  console.error('ERROR: Failed to parse manifest:', error.message);
  process.exit(1);
}
