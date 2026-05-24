import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineConfig({
  plugins: [
    tailwindcss(),
    wasm(),
    topLevelAwait(),
  ],

  server: {
    headers: {
      // SharedArrayBuffer（Pyodide）と WASM スレッドに必要な Cross-Origin 分離ヘッダー
      // S3/CloudFront デプロイ時も同様に設定すること
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  build: {
    target: 'esnext',
  },

  optimizeDeps: {
    exclude: ['blockly'],
  },

  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()],
  },
})
