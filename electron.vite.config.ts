import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin, loadEnv } from 'electron-vite'

export default defineConfig(({ mode }) => {
  Object.assign(
    process.env,
    loadEnv(mode, process.cwd(), [
      'OPENAI_',
      'OPENROUTER_',
      'INTRUSIVE_THOUGHTS_'
    ])
  )

  return {
    main: {
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: {
          input: resolve(__dirname, 'src/main/index.ts'),
          external: ['electron']
        }
      }
    },
    preload: {
      plugins: [externalizeDepsPlugin()],
      build: {
        rollupOptions: {
          input: resolve(__dirname, 'src/preload/index.ts'),
          external: ['electron'],
          output: {
            format: 'cjs',
            entryFileNames: 'index.cjs'
          }
        }
      }
    },
    renderer: {
      root: resolve(__dirname, 'src/renderer'),
      plugins: [react()]
    }
  }
})
