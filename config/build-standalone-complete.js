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

  // Create a temporary vite config that disables code splitting for standalone builds
  const viteConfigPath = path.join(rootDir, 'config', 'vite.config.js');
  const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
  const tempViteConfigPath = path.join(rootDir, 'config', 'vite.config.standalone.js');

  // Modify the config to disable code splitting
  const modifiedConfig = viteConfig.replace(
    /manualChunks:\s*{[^}]*}/s,
    '// Code splitting disabled for standalone build'
  );

  fs.writeFileSync(tempViteConfigPath, modifiedConfig, 'utf8');

  // Use execSync to run vite directly with the modified config
  try {
    execSync('npx vite build --config config/vite.config.standalone.js', {
      stdio: 'inherit',
      cwd: rootDir,
    });
    // eslint-disable-next-line no-console
    console.log('Build completed!\n');
  } catch {
    // eslint-disable-next-line no-console
    console.error('Build failed.');
    // Clean up temp config
    if (fs.existsSync(tempViteConfigPath)) {
      fs.unlinkSync(tempViteConfigPath);
    }
    // eslint-disable-next-line no-undef
    process.exit(1);
  } finally {
    // Clean up temp config
    if (fs.existsSync(tempViteConfigPath)) {
      fs.unlinkSync(tempViteConfigPath);
    }
  }

  // Read built files from the standard dist directory
  const htmlPath = path.join(distDir, 'index.html');
  fs.readFileSync(htmlPath, 'utf8'); // Verify file exists

  // Read CSS and JS
  const assetsDir = path.join(distDir, 'assets');
  const files = fs.readdirSync(assetsDir);

  const cssFiles = files.filter((f) => f.endsWith('.css'));
  const jsFiles = files.filter((f) => f.endsWith('.js'));

  let css = '';
  let js = '';

  // Combine all CSS files
  for (const cssFile of cssFiles) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    css += fs.readFileSync(path.join(assetsDir, cssFile), 'utf8');
  }

  // Combine all JS files (in case code splitting still occurs)
  for (const jsFile of jsFiles) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    js += `${fs.readFileSync(path.join(assetsDir, jsFile), 'utf8')}\n`;
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

  // Remove sourceMappingURL comments to prevent 404 errors for missing .map files
  js = js.replaceAll(/\/\/# sourceMappingURL=.*/g, '');

  // Read and embed the favicon
  const faviconPath = path.join(rootDir, 'public', 'vite.svg');
  const faviconContent = fs.readFileSync(faviconPath, 'utf8');
  const faviconDataUri = `data:image/svg+xml,${encodeURIComponent(faviconContent)}`;

  // Create standalone HTML
  const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="icon" type="image/svg+xml" href="${faviconDataUri}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  
  <!-- SEO Meta Tags -->
  <title>Pinball Accuracy Memory Trainer - Master Shot Recall for Competitive Play</title>
  <meta name="description" content="Practice and improve your pinball shot accuracy memory. Train flipper recall, track progress, and master 39 preset tables. Free interactive tool for competitive players.">
  <meta name="keywords" content="pinball, memory trainer, accuracy training, competitive pinball, flipper mechanics, muscle memory, game training, progressive web app">
  <meta name="author" content="Gary Brown">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  
  <!-- Security Headers (compatible with inline scripts for standalone build) -->
  <meta http-equiv="X-Content-Type-Options" content="nosniff">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  
  <!-- Open Graph / Social Media -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://garybrowndev.github.io/PinballAccuracyMemoryTrainer/">
  <meta property="og:title" content="Pinball Accuracy Memory Trainer">
  <meta property="og:description" content="Train your pinball accuracy and memory with dynamic flipper position tracking. Free, offline-capable tool for competitive players.">
  
  <!-- Embedded Styles -->
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

  // Create serve.json config for SPA routing (serve index.html for all routes)
  const serveConfig = {
    public: '.',
    rewrites: [{ source: '**', destination: '/index.html' }],
  };
  const serveConfigPath = path.join(outputDir, 'serve.json');
  fs.writeFileSync(serveConfigPath, JSON.stringify(serveConfig, null, 2), 'utf8');

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
