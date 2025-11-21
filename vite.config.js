import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
// eslint-disable-next-line import/no-deprecated
import { defineConfig } from 'vite';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));

export default defineConfig({
  plugins: [react(), tailwind()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    // eslint-disable-next-line no-undef
    __BUILD_COMMIT__: JSON.stringify(process.env.BUILD_COMMIT || 'dev'),
    // eslint-disable-next-line no-undef
    __BUILD_COMMIT_URL__: JSON.stringify(process.env.BUILD_COMMIT_URL || ''),
    // eslint-disable-next-line no-undef
    __BUILD_WORKFLOW_URL__: JSON.stringify(process.env.BUILD_WORKFLOW_URL || ''),
  },
  build: {
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true, // allows access via LAN IP (0.0.0.0 bind)
  },
});