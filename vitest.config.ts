import { defineConfig } from 'vitest/config'

// メインの vite.config.ts は tailwindcss プラグインや CSP ヘッダーなどブラウザ向けの
// 設定を持つため、ユニットテスト（Node環境）では独立した最小構成を使う。
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
