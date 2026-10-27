import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const backendProxy = {
  '/api': {
    target: 'http://localhost:5000',
    changeOrigin: true,
    secure: false,
  },
  '/socket.io': {
    target: 'http://localhost:5000',
    ws: true,
    changeOrigin: true,
  },
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    // Sandboxed/preview environments reach the dev server through a proxied
    // hostname, so the host header check must allow it.
    allowedHosts: true,
    proxy: backendProxy,
  },
  preview: {
    port: 4173,
    host: true,
    allowedHosts: true,
    // Keep API calls same-origin in preview builds as well.
    proxy: backendProxy,
  },
});
