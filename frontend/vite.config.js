import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.[jt]sx?$/,
    exclude: []
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  server: {
    fs: {
      strict: false
    },
    proxy: {
      // Dev-time proxy to avoid CORS when calling TomTom from the browser
      '/tomtom': {
        target: 'https://api.tomtom.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/tomtom/, '')
      },
      // Dev-time proxy for HERE Traffic APIs
      '/here': {
        target: 'https://traffic.ls.hereapi.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/here/, '')
      }
    }
  }
})
