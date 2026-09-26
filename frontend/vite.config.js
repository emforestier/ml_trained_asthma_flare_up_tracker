import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // The app calls /api/...; Vite forwards those requests to the FastAPI backend. The browser only
  // sees one address, so the backend doesn't need CORS settings for local development or the demo.
  const proxy = {
    '/api': {
      target: env.BACKEND_URL || 'http://localhost:8000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  };
  return {
    plugins: [react()],
    server: { port: 5173, host: true, proxy },
    preview: { port: 4173, host: true, proxy },
  };
});
