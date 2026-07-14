import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// A new id each build. Emitted as version.json so the running app can detect a
// fresh deploy and offer a refresh (see src/hooks/useUpdatePrompt).
const buildId = String(Date.now())

// Emits dist/version.json containing the current build id.
function emitVersionJson() {
  return {
    name: 'emit-version-json',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ buildId }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the built site works whether it's served from the domain
  // root (vite preview / Netlify) or from a subpath (GitHub Pages).
  base: './',
  plugins: [react(), emitVersionJson()],
  build: {
    rollupOptions: {
      output: {
        // Split big, rarely-changing dependencies into their own chunks so
        // they cache across deploys and download in parallel with app code.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('/react') || id.includes('/scheduler')) return 'react'
        },
      },
    },
  },
  test: {
    globals: true,
  },
})
