import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import fs from 'fs'

export default defineConfig({
  plugins: [
    vue(),
    // Serve images/ folder in dev mode
    {
      name: 'serve-local-images',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/images/')) {
            // Strip leading '/' to avoid Windows path.join issues
            const relPath = decodeURIComponent(req.url.split('?')[0].replace(/^\//, ''))
            const filePath = path.join(process.cwd(), relPath)
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              const ext = path.extname(filePath).toLowerCase()
              const mime = {
                '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif'
              }
              res.setHeader('Content-Type', mime[ext] || 'application/octet-stream')
              res.setHeader('Cache-Control', 'public, max-age=86400')
              fs.createReadStream(filePath).pipe(res)
              return
            }
          }
          next()
        })
      }
    }
  ],
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks: {
          exceljs: ['exceljs'],
          photoswipe: ['photoswipe'],
        }
      }
    }
  },
  resolve: {
    alias: { '@': path.resolve('./src') }
  }
})
