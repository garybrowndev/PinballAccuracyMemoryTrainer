import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

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