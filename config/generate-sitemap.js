/**
 * Automated sitemap.xml generator
 * Generates sitemap with all preset pages and main routes
 */

/* global process */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://garybrowndev.github.io/PinballAccuracyMemoryTrainer';
const PRIORITY_HIGH = '1.0';
const PRIORITY_MEDIUM = '0.8';
const PRIORITY_LOW = '0.6';
const CHANGE_FREQ_DAILY = 'daily';
const CHANGE_FREQ_WEEKLY = 'weekly';
const CHANGE_FREQ_MONTHLY = 'monthly';

/**
 * Load preset index to generate URLs
 */
function loadPresets() {
  try {
    const presetsPath = path.join(__dirname, '../public/presets/index.json');
    const presetsData = readFileSync(presetsPath, 'utf8');
    return JSON.parse(presetsData);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error loading presets:', error);
    return [];
  }
}

/**
 * Generate sitemap XML
 */
function generateSitemap() {
  const now = new Date().toISOString().split('T')[0];
  const presets = loadPresets();

  let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
  sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Main page
  sitemap += '  <url>\n';
  sitemap += `    <loc>${BASE_URL}/</loc>\n`;
  sitemap += `    <lastmod>${now}</lastmod>\n`;
  sitemap += `    <changefreq>${CHANGE_FREQ_DAILY}</changefreq>\n`;
  sitemap += `    <priority>${PRIORITY_HIGH}</priority>\n`;
  sitemap += '  </url>\n';

  // Preset pages (if we add individual preset pages in the future)
  for (const preset of presets) {
    const slug = preset.name
      .toLowerCase()
      .replaceAll(/[^\da-z]+/g, '-')
      .replaceAll(/^-+|-+$/g, '');

    sitemap += '  <url>\n';
    sitemap += `    <loc>${BASE_URL}/?preset=${encodeURIComponent(slug)}</loc>\n`;
    sitemap += `    <lastmod>${now}</lastmod>\n`;
    sitemap += `    <changefreq>${CHANGE_FREQ_MONTHLY}</changefreq>\n`;
    sitemap += `    <priority>${PRIORITY_MEDIUM}</priority>\n`;
    sitemap += '  </url>\n';
  }

  sitemap += '</urlset>\n';

  return sitemap;
}

/**
 * Write sitemap to file
 */
function writeSitemap() {
  const sitemap = generateSitemap();
  const outputPath = path.join(__dirname, '../public/sitemap.xml');

  writeFileSync(outputPath, sitemap, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`✓ Sitemap generated: ${outputPath}`);
  // eslint-disable-next-line no-console
  console.log(`  Total URLs: ${(sitemap.match(/<url>/g) || []).length}`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  writeSitemap();
}

export { generateSitemap, writeSitemap };
