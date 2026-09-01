import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 500,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /[\\/]node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: 'motion-vendor', test: /[\\/]node_modules[\\/](motion|framer-motion)[\\/]/ },
            { name: 'query-vendor', test: /[\\/]node_modules[\\/](@tanstack|axios)[\\/]/ },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
})
