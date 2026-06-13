import { defineConfig } from 'vitest/config'

// メインの vite.config.ts は wasm / monaco / static-copy など重いプラグインを
// 読み込むため、ユニットテストでは独立した最小構成を使う。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
