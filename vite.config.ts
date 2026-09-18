import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'

export default defineConfig({
  base: './',
  plugins: [react(), vanillaExtractPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // 화면 흐름 테스트만 .tsx 다. 그 파일들은 머리에 `@vitest-environment jsdom` 을 적어 둔다.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // 변환 결과를 디스크에 남겨 다시 돌릴 때 빠르게 한다
    fsModuleCache: true,
  },
})
