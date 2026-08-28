import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev (`npm run dev`) the SPA runs on :5173 and proxies /api to the Django
// dev server on :8000. In production the build is static files served by nginx,
// which does the /api proxying instead (see nginx/default.conf).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
