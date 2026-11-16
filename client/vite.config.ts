import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev the client runs on :5173 and proxies the socket to the game server on :3000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2500,
  },
});
