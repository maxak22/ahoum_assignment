import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev (`npm run dev`) the SPA runs on :5173 and proxies /api to the running
// stack. The target is the nginx edge (:80) from `docker compose up`, which
// routes /api to the backend — same path the browser takes in production.
// If you run Django standalone instead (README Option B), change this to
// http://localhost:8000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:80',
    },
  },
})
