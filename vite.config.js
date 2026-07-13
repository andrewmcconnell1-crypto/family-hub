import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the built site works whether it's served from the domain
  // root (vite preview / Netlify) or from a subpath (GitHub Pages).
  base: './',
  plugins: [react()],
  test: {
    globals: true,
  },
})
