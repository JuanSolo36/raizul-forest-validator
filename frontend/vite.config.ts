import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Cualquier petición del front hacia /analisis-forestal se redirige internamente al backend
      '/analisis-forestal': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      },
      '/muestras': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true
      }
    }
  }
});