import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    allowedHosts: true,
  },

  // The WebP encoder ships its own .wasm next to the module.
  optimizeDeps: {
    exclude: ['@jsquash/webp'],
  },
  worker: {
    format: 'es',
  },
})