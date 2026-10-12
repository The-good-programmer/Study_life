import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { configDefaults } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    // Worktrees under .claude/ are other checkouts; their edits shouldn't reload this app.
    watch: { ignored: ['**/.claude/**'] },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5175,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'three'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
      'three',
      'three/examples/jsm/loaders/GLTFLoader.js',
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            // The glTF/KTX2 loaders are imported on demand by the v2 avatar;
            // keep them out of the core chunk so v1 users never download them.
            if (/three\/examples\/jsm\/(loaders\/(GLTF|KTX2)Loader|libs\/meshopt)/.test(id)) {
              return 'vendor-three-loaders';
            }
            if (id.includes('three')) {
              return 'vendor-three';
            }
            if (id.includes('@google/genai')) {
              return 'vendor-genai';
            }
            if (id.includes('pdfjs-dist')) {
              return 'vendor-pdfjs';
            }
          }
        },
      },
    },
  },
  test: {
    setupFiles: ['./src/test-setup.ts'],
    // Worktrees under .claude/ are other checkouts of this repo; their tests aren't this one's.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
