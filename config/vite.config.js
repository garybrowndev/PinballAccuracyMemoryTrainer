import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
// eslint-disable-next-line import/no-deprecated
import { defineConfig } from 'vite';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

export default defineConfig({
  plugins: [react(), tailwind()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),

    __BUILD_COMMIT__: JSON.stringify(process.env.BUILD_COMMIT || 'dev'),

    __BUILD_COMMIT_URL__: JSON.stringify(process.env.BUILD_COMMIT_URL || ''),

    __BUILD_WORKFLOW_URL__: JSON.stringify(process.env.BUILD_WORKFLOW_URL || ''),
  },
  build: {
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: false,
    host: '127.0.0.1', // Force IPv4 instead of IPv6
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/vitest/setupTests.js',
    css: true,
    include: ['tests/vitest/**/*.test.{js,jsx,ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-standalone/**',
      '**/tests/e2e/**', // Exclude Playwright E2E tests
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
    ],
    api: {
      port: 8888, // Use a port outside Windows reserved ranges (51135-52005 are blocked by Windows)
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/dist-standalone/**',
        '**/tests/**',
        '**/test-results/**',
        '**/playwright-report/**',
        '**/*.config.js',
        '**/*.config.ts',
        '**/setupTests.js',
        '**/build-standalone-complete.js',
        '**/src/main.jsx', // Entry point, typically not unit tested
      ],
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      all: true,
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
  },
});