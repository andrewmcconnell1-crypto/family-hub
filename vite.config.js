import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the built site works whether it's served from the domain
  // root (vite preview / Netlify) or from a subpath (GitHub Pages).
  base: './',
  plugins: [react()],
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
