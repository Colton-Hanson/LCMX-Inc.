// vite.config.js — settings for Vite, the tool that runs our dev server and builds the app.

import { defineConfig } from 'vite'; // helper that gives editor autocomplete for the settings
import react from '@vitejs/plugin-react'; // teaches Vite how to read React/JSX files

// Where Lukas's FastAPI backend runs. 8000 is uvicorn's default port:  uvicorn app.main:app --reload
// If yours differs, either edit this line or start the frontend like:  BACKEND_URL=http://localhost:9000 npm run dev
// (on Windows PowerShell:  $env:BACKEND_URL="http://localhost:9000"; npm run dev)
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000'; // BACKEND HOOK

export default defineConfig({
  plugins: [react()], // turn on React support
  server: {
    // BACKEND HOOK: in dev, any request starting with /api is forwarded to the backend, with "/api" removed.
    //   browser calls  /api/auth/login   ->   backend receives  /auth/login
    // Why a proxy? The page runs on :5173 and the API on :8000. Browsers block that "cross-origin" call
    // (and drop the login cookie) unless the server is set up for it. Through the proxy the browser only ever
    // talks to :5173, so none of that comes up.
    // A production build has no proxy: serve the app and the API from one domain with a reverse proxy
    // that applies the same "/api" -> backend rule.
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''), // drop the "/api" prefix before it reaches the backend
      },
    },
  },
  // Settings for Vitest (the test runner), which reuses this file.
  test: {
    environment: 'jsdom', // simulates a browser inside Node so React components can be tested without opening Chrome
    globals: true, // lets tests use describe / it / expect without importing them
    setupFiles: './tests/setup.js', // runs once before the tests (adds extra assertions like toBeInTheDocument)
  },
});
