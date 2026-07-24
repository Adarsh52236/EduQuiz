import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174, // Teacher frontend dev server will run on 5174
    strictPort: true,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // Proxy API requests to backend on 3001
        changeOrigin: true,
        // Remove the rewrite function to keep the /api prefix
      },
    },
  }
});