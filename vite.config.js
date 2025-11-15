import tailwind from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
// eslint-disable-next-line import/no-deprecated
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwind()],
  build: {
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true, // allows access via LAN IP (0.0.0.0 bind)
  },
});