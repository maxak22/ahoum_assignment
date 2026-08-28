import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev (`npm run dev`) the SPA runs on :5173 and proxies /api to the running
// stack. The target is the nginx edge (:80) from `docker compose up`, which
// routes /api to the backend — same path the browser takes in production.
// If you run Django standalone instead (README Option B), change this to
// http://localhost:8000.
export default defineConfig({
  plugins: [react()],
  // Read the repo-root .env (the same file docker compose uses) so
  // VITE_GOOGLE_CLIENT_ID / VITE_API_BASE_URL only live in one place.
  // Only VITE_-prefixed vars are ever exposed to the client bundle.
  envDir: '..',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:80',
    },
    // lets the Google sign-in popup communicate back to the page
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
})
