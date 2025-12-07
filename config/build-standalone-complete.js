import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

async function buildStandaloneWithAssets() {
  // Note: Lint and tests are run by the CI workflow before this script is called.
  // Running them again here would be redundant and could cause issues with generated files.

  // eslint-disable-next-line no-console
  console.log('Building Vite bundle...');

  // Clean any existing dist to force a fresh build
  const distDir = path.join(rootDir, 'dist');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }

  // Use execSync to run the build command normally (this ensures Tailwind processes correctly)
  try {
    execSync('npm run build', { stdio: 'inherit', cwd: rootDir });
    // eslint-disable-next-line no-console
    console.log('Build completed!\n');
  } catch {
    // eslint-disable-next-line no-console
    console.error('Build failed.');
    // eslint-disable-next-line no-undef
    process.exit(1);
  }

  // Read built files from the standard dist directory
  const htmlPath = path.join(distDir, 'index.html');
  fs.readFileSync(htmlPath, 'utf8'); // Verify file exists

  // Read CSS and JS
  const assetsDir = path.join(distDir, 'assets');
  const files = fs.readdirSync(assetsDir);

  const cssFile = files.find((f) => f.endsWith('.css'));
  const jsFile = files.find((f) => f.endsWith('.js'));

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
  const elementsDir = path.join(rootDir, 'public', 'images', 'elements');
  const imageFiles = fs.readdirSync(elementsDir).filter((f) => f.endsWith('.webp'));
  const imageMap = {};

  // eslint-disable-next-line no-console
  console.log(`Embedding ${imageFiles.length} images...`);
  for (const file of imageFiles) {
    const imagePath = path.join(elementsDir, file);
    const base64 = imageToBase64(imagePath);
    const name = file.replace('.webp', '');
    imageMap[name] = `data:image/webp;base64,${base64}`;
  }

  // Embed all presets
  const presetsDir = path.join(rootDir, 'public', 'presets');
  const presetFiles = fs.readdirSync(presetsDir).filter((f) => f.endsWith('.json'));
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

  js = `${embeddedAssets}\n${js}`;

  // Replace all image source references to use EMBEDDED_IMAGES
  // The code is minified, so we need to handle both minified and non-minified patterns

  // Replace IMAGE_BASE_URL assignments (both const and let, with various variable names)
  js = js.replaceAll(/([$A-Z_a-z][\w$]*)=["']\/images\/elements["']/g, '$1=""');

  // Also try to match non-minified patterns for safety
  js = js.replaceAll(/const\s+IMAGE_BASE_URL\s*=\s*["'][^"']*["']/g, 'const IMAGE_BASE_URL = ""');

  js = js.replaceAll(/let\s+IMAGE_BASE_URL\s*=\s*["'][^"']*["']/g, 'let IMAGE_BASE_URL = ""');

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
  const outputDir = path.join(rootDir, 'dist-standalone');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output
  const outputPath = path.join(outputDir, 'pinball-trainer-standalone.html');
  fs.writeFileSync(outputPath, standaloneHtml, 'utf8');

  // Note: We're using the regular dist build, so no temp directory to clean up

  const stats = fs.statSync(outputPath);
  // eslint-disable-next-line no-console
  console.log(`\nStandalone HTML with embedded assets created: ${outputPath}`);
  // eslint-disable-next-line no-console
  console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  // eslint-disable-next-line no-console
  console.log(`Embedded ${imageFiles.length} images and ${presetFiles.length} presets`);
}

// eslint-disable-next-line promise/prefer-await-to-callbacks
buildStandaloneWithAssets().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Build failed:', error);
  // eslint-disable-next-line no-undef
  process.exit(1);
});
