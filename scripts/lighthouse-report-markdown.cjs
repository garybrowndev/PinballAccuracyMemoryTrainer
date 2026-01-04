/**
 * Generate markdown report from Lighthouse metadata and manifest
 *
 * Usage: node lighthouse-report-markdown.cjs <metadata-json-file> [manifest-dir]
 *
 * Reads metadata JSON and manifest.json to generate formatted markdown report
 * with scores, emoji indicators, and links to detailed reports.
 */

const fs = require('fs');

// Get score emoji based on threshold
function getScoreEmoji(score) {
  const percentage = score * 100;
  if (percentage >= 90) return '🟢';
  if (percentage >= 80) return '🟡';
  return '🔴';
}

// Format score as percentage string
function formatScore(score) {
  return `${Math.round(score * 100)}%`;
}

// Main function
function generateReport() {
  // Get metadata file path from command line
  const metadataPath = process.argv[2];
  if (!metadataPath) {
    // eslint-disable-next-line no-console -- CLI script needs console output
    console.error('Error: metadata file path required');
    // eslint-disable-next-line no-console -- CLI script needs console output
    console.error('Usage: node lighthouse-report-markdown.cjs <metadata-json-file> [manifest-dir]');
    process.exit(1);
  }

  // Check if metadata file exists
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path from CLI arg
  if (!fs.existsSync(metadataPath)) {
    // eslint-disable-next-line no-console -- CLI script needs console output
    console.error(`Error: metadata file not found: ${metadataPath}`);
    process.exit(1);
  }

  // Read metadata
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path from CLI arg
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const { device, url, scores } = metadata;

  // Try to read manifest for additional report info
  // Note: The temporary-public-storage URL is not in manifest.json,
  // it's printed to stdout by 'lhci upload' command. Workflows should capture it.
  // For now, skip trying to get report URL from manifest since it's not there

  // Generate markdown report
  const lines = [];
  lines.push(`## 🔦 Lighthouse Report - ${device.charAt(0).toUpperCase() + device.slice(1)}`);
  lines.push('');
  lines.push(`**URL:** ${url}`);
  lines.push('');
  lines.push('| Category | Score |');
  lines.push('|----------|-------|');
  lines.push(
    `| ${getScoreEmoji(scores.performance)} Performance | ${formatScore(scores.performance)} |`
  );
  lines.push(
    `| ${getScoreEmoji(scores.accessibility)} Accessibility | ${formatScore(scores.accessibility)} |`
  );
  lines.push(
    `| ${getScoreEmoji(scores.bestPractices)} Best Practices | ${formatScore(scores.bestPractices)} |`
  );
  lines.push(`| ${getScoreEmoji(scores.seo)} SEO | ${formatScore(scores.seo)} |`);
  lines.push('');

  // Output markdown
  // eslint-disable-next-line no-console -- CLI script needs console output
  console.log(lines.join('\n'));
}

// Run
generateReport();
