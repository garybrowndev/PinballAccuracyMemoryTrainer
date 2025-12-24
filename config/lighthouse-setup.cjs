#!/usr/bin/env node
/**
 * Cross-platform setup script for Lighthouse CI
 * Creates test directory and copies standalone HTML
 */

const fs = require('fs');
const path = require('path');

const testDir = path.join(process.cwd(), 'lighthouse-test');
const sourceFile = path.join(process.cwd(), 'dist-standalone', 'pinball-trainer-standalone.html');
const targetFile = path.join(testDir, 'index.html');

// Create directory if it doesn't exist
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
  console.log('✓ Created lighthouse-test directory');
}

// Copy file
fs.copyFileSync(sourceFile, targetFile);
console.log('✓ Copied standalone HTML to lighthouse-test/index.html');
