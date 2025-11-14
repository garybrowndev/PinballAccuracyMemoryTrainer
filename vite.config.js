import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import electron from 'vite-plugin-electron'
import electronRenderer from 'vite-plugin-electron-renderer'

export default defineConfig(({ mode }) => {
  const isElectron = mode === 'electron';
  
  return {
    plugins: [
      react(), 
      tailwind(),
      ...(isElectron ? [
        electron({
          entry: 'electron/main.js',
        }),
        electronRenderer(),
      ] : [])
    ],
    build: {
      sourcemap: true,
      outDir: 'dist',
    },
    server: {
      port: 5173,
      strictPort: true,
      host: true // allows access via LAN IP (0.0.0.0 bind)
    },
    base: './', // Important for Electron to load assets correctly
  }
})