import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
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

/**
 * Writes the public pages (src/publicPages/buildPublicPages.ts) into the build: /decks/, a page per
 * starter deck, sitemap.xml and robots.txt. They are plain HTML that search engines can read. The
 * module is loaded through Vite so it can use the app's TypeScript and data as they are.
 * The site's address comes from SITE_URL, or else from og:url in index.html.
 */
function publicPages(): Plugin {
  let outDir = 'dist'
  let root = process.cwd()
  return {
    name: 'studify-public-pages',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
      root = config.root
    },
    async closeBundle() {
      const indexHtml = readFileSync(join(root, 'index.html'), 'utf8')
      const siteUrl = process.env.SITE_URL || /property="og:url" content="([^"]+)"/.exec(indexHtml)?.[1] || 'https://studify.app/'
      const { createServer } = await import('vite')
      const server = await createServer({
        root,
        configFile: false,
        logLevel: 'error',
        appType: 'custom',
        server: { middlewareMode: true, hmr: false, watch: null },
        oxc: { jsx: { runtime: 'automatic' } },
      })
      try {
        const { buildPublicPages } = await server.ssrLoadModule('/src/publicPages/buildPublicPages.ts')
        for (const { file, content } of buildPublicPages(siteUrl) as { file: string; content: string }[]) {
          const target = join(outDir, file)
          mkdirSync(dirname(target), { recursive: true })
          writeFileSync(target, content)
        }
      } finally {
        await server.close()
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    stampServiceWorker(),
    publicPages(),
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
          // Every lazy import() calls Vite's preload helper. Left unassigned, the
          // bundler drops it into one of the vendor chunks below (it picked
          // pdf.js), and that whole chunk then loads with the start page.
          if (id === '\0vite/preload-helper.js') {
            return 'preload-helper';
          }
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
    // e2e/ holds the browser tests, run by Playwright (npm run e2e).
    exclude: [...configDefaults.exclude, '.claude/**', 'e2e/**'],
  },
})
