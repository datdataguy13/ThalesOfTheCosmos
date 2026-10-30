import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// `base` is set by the GitHub Pages workflow (VITE_BASE=/<repo-name>/) so the
// built asset URLs match the project-page sub-path. Locally it defaults to '/'.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: { port: 5173, open: true },
})
