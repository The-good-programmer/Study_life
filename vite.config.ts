import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { configDefaults } from 'vitest/config'

/**
 * Stamps a build id into dist/sw.js. The browser only installs a new service
 * worker when sw.js changes, so without this, users would keep the first
 * deploy's worker (and its caches) forever. The id is a hash of index.html
 * (which names every hashed entry chunk) and the worker's own sources, so it
 * changes exactly when the app does.
 */
function stampServiceWorker(): Plugin {
  let outDir = 'dist'
  return {
    name: 'studify-stamp-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const sw = join(outDir, 'sw.js')
      const source = readFileSync(sw, 'utf8')
      const id = createHash('sha256')
        .update(readFileSync(join(outDir, 'index.html')))
        .update(readFileSync(join(outDir, 'sw-routes.js')))
        .update(source)
        .digest('hex')
        .slice(0, 12)
      writeFileSync(sw, source.replace("'__BUILD_ID__'", `'${id}'`))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    stampServiceWorker(),
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
