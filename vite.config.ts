import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiProxy = {
  '/api': {
    target: 'http://localhost:8787',
    changeOrigin: false,
  },
}

export default defineConfig(({ command, mode }) => {
  const desktop = mode === 'desktop'

  return {
    plugins: [react(), tailwindcss()],
    base: command === 'build' && desktop ? './' : '/',
    build: desktop ? { outDir: 'dist-desktop' } : undefined,
    server: { proxy: apiProxy, port: 5173, strictPort: true },
    preview: { proxy: apiProxy },
  }
})
