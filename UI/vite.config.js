import { defineConfig } from 'vite'

// Proxy `/api` requests from Vite dev server to backend running on localhost:4000
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
