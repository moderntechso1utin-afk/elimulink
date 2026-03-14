import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: './',
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    allowedHosts: [
      'app.localhost',
      'student.localhost',
      'institution.localhost',
      'localhost',
      '127.0.0.1',
    ],
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 3000,
      clientPort: 3000,
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  }
})
