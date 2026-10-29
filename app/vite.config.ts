import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Tauri expects a fixed port and must not have Vite clear its output;
// 1437, not the Tauri default 1420, so other Tauri apps can run alongside
export default defineConfig({
  plugins: [react()],
  base: './',
  clearScreen: false,
  server: {
    port: 1437,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] }
  }
})
