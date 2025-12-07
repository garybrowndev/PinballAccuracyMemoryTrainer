import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
// eslint-disable-next-line import/no-deprecated
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

export default defineConfig({
  plugins: [
    react(),
    tailwind(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg', 'robots.txt', 'sitemap.xml', 'images/**/*'],
      manifest: false, // Use existing manifest.json
      devOptions: {
        enabled: true, // Enable service worker in dev mode
        type: 'module',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,webp,json}'],
        globIgnores: ['**/node_modules/**', '**/test-results/**', '**/coverage/**'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\/presets\/.*\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'pinball-presets-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
    visualizer({
      filename: './dist/stats.html',
      open: false, // Don't auto-open, use npm run analyze instead
      gzipSize: true,
      brotliSize: true,
      template: 'treemap', // treemap, sunburst, network
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),

    __BUILD_COMMIT__: JSON.stringify(process.env.BUILD_COMMIT || 'dev'),

    __BUILD_COMMIT_URL__: JSON.stringify(process.env.BUILD_COMMIT_URL || ''),

    __BUILD_WORKFLOW_URL__: JSON.stringify(process.env.BUILD_WORKFLOW_URL || ''),

    __RELEASE_URL__: JSON.stringify(process.env.RELEASE_URL || ''),
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
    css: false, // Disable CSS processing for faster tests
    include: ['tests/vitest/**/*.test.{js,jsx,ts,tsx}'],
    pool: 'threads', // Use worker threads for parallelism
    testTimeout: 10000, // 10s default timeout
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
      lines: 60,
      functions: 75,
      branches: 60,
      statements: 60,
    },
  },
});
