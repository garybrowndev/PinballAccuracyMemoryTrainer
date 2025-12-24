#!/usr/bin/env node
/**
 * Injects a synthetic Branch-Protection check result into Scorecard SARIF files.
 *
 * Purpose: Branch-Protection check only runs on default branch (per OSSF docs).
 * On PRs, this check is skipped, causing SARIF rule mismatch errors in GitHub Code Scanning.
 * This script ensures consistent SARIF structure across all branches by injecting
 * a passing Branch-Protection result when the check didn't run.
 *
 * Usage: node inject-branch-protection.js <sarif-file-path>
 */

/* eslint-disable no-console, security/detect-non-literal-fs-filename */

const fs = require('fs');
const path = require('path');

const BRANCH_PROTECTION_RULE = {
  id: 'Branch-Protection',
  name: 'Branch-Protection',
  shortDescription: {
    text: "Determines if the default and release branches are protected with GitHub's branch protection settings.",
  },
  fullDescription: {
    text: 'Branch protection allows defining rules that enforce certain workflows for branches, such as requiring review or passing tests before acceptance into a main branch, or preventing rewriting of public history.',
  },
  help: {
    text: 'Branch protection allows defining rules that enforce certain workflows for branches. See https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches',
    markdown:
      'Branch protection allows defining rules that enforce certain workflows for branches. See [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)',
  },
  defaultConfiguration: {
    level: 'warning',
  },
  properties: {
    tags: ['security'],
    precision: 'high',
  },
};

const SYNTHETIC_RESULT = {
  ruleId: 'Branch-Protection',
  ruleIndex: -1, // Will be updated after insertion
  level: 'note',
  message: {
    text: 'Branch-Protection check skipped on non-default branch (synthetic result for SARIF consistency)',
  },
  locations: [
    {
      physicalLocation: {
        artifactLocation: {
          uri: '.github/workflows/security-ossf-scorecard.yml',
        },
        region: {
          startLine: 1,
          startColumn: 1,
          endLine: 1,
          endColumn: 1,
        },
      },
    },
  ],
  partialFingerprints: {
    primaryLocationLineHash: 'synthetic:branch-protection:1',
  },
};

function injectBranchProtection(sarifPath) {
  console.log(`Reading SARIF file: ${sarifPath}`);
  const sarif = JSON.parse(fs.readFileSync(sarifPath, 'utf8'));

  if (!sarif.runs || sarif.runs.length === 0) {
    console.error('Error: No runs found in SARIF file');
    process.exit(1);
  }

  const run = sarif.runs[0];

  // Check if Branch-Protection rule already exists
  const rules = run.tool.driver.rules || [];
  const existingRuleIndex = rules.findIndex((r) => r.id === 'Branch-Protection');

  if (existingRuleIndex !== -1) {
    console.log('Branch-Protection rule already exists - skipping injection');
    return;
  }

  // Add the rule definition
  console.log('Injecting Branch-Protection rule definition...');
  rules.push(BRANCH_PROTECTION_RULE);
  run.tool.driver.rules = rules;

  // Add synthetic result
  console.log('Injecting synthetic Branch-Protection result...');
  const results = run.results || [];
  const syntheticResult = { ...SYNTHETIC_RESULT };
  syntheticResult.ruleIndex = rules.length - 1; // Index of the rule we just added
  results.push(syntheticResult);
  run.results = results;

  // Write modified SARIF back to file
  const outputPath = sarifPath + '.tmp';
  console.log(`Writing modified SARIF to: ${outputPath}`);
  fs.writeFileSync(outputPath, JSON.stringify(sarif, null, 2), 'utf8');
  console.log('✓ Successfully injected Branch-Protection result');
  console.log(`Rename ${outputPath} to ${sarifPath} to use the modified file`);
}

// Main execution
const args = process.argv.slice(2);
if (args.length !== 1) {
  console.error('Usage: node inject-branch-protection.js <sarif-file-path>');
  process.exit(1);
}

const sarifPath = path.resolve(args[0]);
if (!fs.existsSync(sarifPath)) {
  console.error(`Error: File not found: ${sarifPath}`);
  process.exit(1);
}

try {
  injectBranchProtection(sarifPath);
} catch (error) {
  console.error('Error processing SARIF file:', error.message);
  process.exit(1);
}
