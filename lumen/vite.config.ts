import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Prevent vite from obscuring Rust errors
  clearScreen: false,
  // Tauri expects a fixed port, fail if that port is not available
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  server: {
    port: 5173,
    strictPort: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  test: {
    exclude: ['**/node_modules/**', '**/e2e/**', '**/dist/**'],
  },
})
