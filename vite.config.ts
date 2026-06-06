import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import monacoEditorPluginModule from 'vite-plugin-monaco-editor'
const monacoEditorPlugin = (monacoEditorPluginModule as unknown as { default: typeof monacoEditorPluginModule }).default ?? monacoEditorPluginModule

export default defineConfig({
  // CI 環境（GitHub Actions）では GitHub Pages のサブパスに合わせる
  base: process.env.CI ? '/narapy/' : '/',

  plugins: [
    tailwindcss(),
    wasm(),
    topLevelAwait(),
    // COEP 環境でも Blockly メディアを同一オリジンから配信するためにコピー
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/blockly/media/*',
          dest: 'blockly-media',
        },
      ],
    }),
    // Monaco のワーカーを同一オリジンからバンドル配信（COEP 対応）
    monacoEditorPlugin({ languageWorkers: ['editorWorkerService'] }),
  ],

  server: {
    headers: {
      // SharedArrayBuffer（Pyodide）と WASM スレッドに必要な Cross-Origin 分離ヘッダー
      // S3/CloudFront デプロイ時も同様に設定すること
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      // Content Security Policy
      // unsafe-eval: Monaco Editor / Pyodide が動的コード評価を必要とするため必須
      // blob: / cdn.jsdelivr.net: Pyodide を CDN + Blob URL 経由でロードするため必要
      // connect-src cdn.jsdelivr.net: Pyodide パッケージのダウンロード
      // connect-src files.pythonhosted.org pypi.org: micropip によるパッケージインストール
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' blob: cdn.jsdelivr.net",
        "worker-src 'self' blob:",
        "img-src 'self' data: blob:",
        "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
        "font-src 'self' fonts.gstatic.com data:",
        "connect-src 'self' cdn.jsdelivr.net files.pythonhosted.org pypi.org",
        "frame-src 'none'",
        "object-src 'none'",
      ].join('; '),
    },
  },

  build: {
    target: 'esnext',
  },

  optimizeDeps: {
    // blockly は CJS モジュールのため esbuild でプリバンドル（ESM 変換）させる
    include: ['blockly', 'blockly/python'],
  },

  worker: {
    format: 'es',
    plugins: () => [wasm(), topLevelAwait()],
  },
})
