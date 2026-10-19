import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
// Modified by 马路Milo, 2026-10-19: support GitHub Pages repository paths.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [tailwindcss(), react()],
  worker: {
    format: 'es',
    plugins: () => [react()]
  },
  build: {
    // Keep Rollup chunking strategy default/stable.
    // (Custom manualChunks caused a runtime TDZ error in a vendor chunk on deployment.)
    chunkSizeWarningLimit: 650
  },
  optimizeDeps: {
    exclude: ['src/workers/dither.worker.ts']
  }
})
