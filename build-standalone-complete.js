import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// eslint-disable-next-line import/no-deprecated
import { build } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildStandaloneWithAssets() {
  // eslint-disable-next-line no-console
  console.log('Running lint check...');
  try {
    execSync('npm run lint', { stdio: 'inherit', cwd: __dirname });
    // eslint-disable-next-line no-console
    console.log('Lint check passed!\n');
  } catch {
    // eslint-disable-next-line no-console
    console.error('Lint check failed. Please fix linting errors before building.');
    // eslint-disable-next-line no-undef
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log('Building Vite bundle first...');

  // Build with Vite
  await build({
    build: {
      outDir: 'dist-standalone-temp',
      rollupOptions: {
        input: './index.html',
      },
    },
  });

  // Read built files
  const distDir = path.join(__dirname, 'dist-standalone-temp');
  const htmlPath = path.join(distDir, 'index.html');
  fs.readFileSync(htmlPath, 'utf8'); // Verify file exists

  // Read CSS and JS
  const assetsDir = path.join(distDir, 'assets');
  const files = fs.readdirSync(assetsDir);

  const cssFile = files.find(f => f.endsWith('.css'));
  const jsFile = files.find(f => f.endsWith('.js'));

  let css = '';
  let js = '';

  if (cssFile) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    css = fs.readFileSync(path.join(assetsDir, cssFile), 'utf8');
  }

  if (jsFile) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    js = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');
  }

  // Function to convert image to base64
  function imageToBase64(imagePath) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString('base64');
  }

  // Embed all element images
  const elementsDir = path.join(__dirname, 'public', 'images', 'elements');
  const imageFiles = fs.readdirSync(elementsDir).filter(f => f.endsWith('.jpg'));
  const imageMap = {};

  // eslint-disable-next-line no-console
  console.log(`Embedding ${imageFiles.length} images...`);
  for (const file of imageFiles) {
    const imagePath = path.join(elementsDir, file);
    const base64 = imageToBase64(imagePath);
    const name = file.replace('.jpg', '');
    imageMap[name] = `data:image/jpeg;base64,${base64}`;
  }

  // Embed all presets
  const presetsDir = path.join(__dirname, 'public', 'presets');
  const presetFiles = fs.readdirSync(presetsDir).filter(f => f.endsWith('.json'));
  const presets = {};
  let presetIndex = [];

  // eslint-disable-next-line no-console
  console.log(`Embedding ${presetFiles.length} presets...`);
  for (const file of presetFiles) {
    const presetPath = path.join(presetsDir, file);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const presetData = fs.readFileSync(presetPath, 'utf8');

    if (file === 'index.json') {
      // Store the index separately
      presetIndex = JSON.parse(presetData);
    } else {
      presets[file] = JSON.parse(presetData);
    }
  }

  // Add embedded assets at the beginning of the JS - assign to window for global access
  const embeddedAssets = `
// Embedded assets for standalone mode
window.EMBEDDED_IMAGES = ${JSON.stringify(imageMap)};
window.EMBEDDED_PRESETS = ${JSON.stringify(presets)};
window.EMBEDDED_PRESET_INDEX = ${JSON.stringify(presetIndex)};
`;

  js = `${embeddedAssets }\n${ js}`;

  // Replace all image source references to use EMBEDDED_IMAGES
  // Match various patterns for imgSrc construction
  js = js.replace(
    /const\s+imgSrc\s*=\s*`\${IMAGE_BASE_URL}\/\${slug}\.jpg`/g,
    'const imgSrc = EMBEDDED_IMAGES[slug] || ""',
  );
  js = js.replace(
    /const\s+imgSrc\s*=\s*slug\s*\?\s*`\${IMAGE_BASE_URL}\/\${slug}\.jpg`\s*:\s*null/g,
    'const imgSrc = slug ? (EMBEDDED_IMAGES[slug] || "") : null',
  );
  js = js.replace(
    /imgSrc\s*=\s*`\${IMAGE_BASE_URL}\/\${slug}\.jpg`/g,
    'imgSrc = EMBEDDED_IMAGES[slug] || ""',
  );

  // Also replace IMAGE_BASE_URL definition to empty string so it doesn't interfere
  js = js.replace(
    /const\s+IMAGE_BASE_URL\s*=\s*["'][^"']*["']/g,
    'const IMAGE_BASE_URL = ""',
  );

  // Create standalone HTML
  const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pinball Accuracy Memory Trainer</title>
  <style>${css}</style>
</head>
<body>
  <div id="root"></div>
  <script type="module">${js}</script>
</body>
</html>`;

  // Create output directory if it doesn't exist
  const outputDir = path.join(__dirname, 'dist-standalone');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output
  const outputPath = path.join(outputDir, 'pinball-trainer-standalone.html');
  fs.writeFileSync(outputPath, standaloneHtml, 'utf8');

  // Clean up temp directory
  fs.rmSync(distDir, { recursive: true, force: true });

  const stats = fs.statSync(outputPath);
  // eslint-disable-next-line no-console
  console.log(`\nStandalone HTML with embedded assets created: ${outputPath}`);
  // eslint-disable-next-line no-console
  console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  // eslint-disable-next-line no-console
  console.log(`Embedded ${imageFiles.length} images and ${presetFiles.length} presets`);
}

// eslint-disable-next-line promise/prefer-await-to-callbacks
buildStandaloneWithAssets().catch(error => {
  // eslint-disable-next-line no-console
  console.error('Build failed:', error);
  // eslint-disable-next-line no-undef
  process.exit(1);
});
