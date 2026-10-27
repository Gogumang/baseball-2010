import { configDefaults, defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { spriteJsonBundle } from './tools/viteSpriteJsonBundle.ts'
import { versionedAssets } from './tools/viteVersionedAssets.ts'
import { assetPacks } from './tools/viteAssetPacks.ts'

export default defineConfig({
  base: './',
  // 스프라이트 JSON 265개를 한 파일로 — `sprites/sprite-json.bundle.json` (r311 A5, `shared/lib/sprite/spriteJsonBundle`)
  // 빌드 산출물의 `public/` 을 `v/<내용 해시>/` 로 — 호스트가 오래 캐시해도 배포 뒤 옛 그림이 안 섞인다 (r318 A2, `shared/lib/assetUrl`)
  // 빌드 산출물 자산을 gzip 묶음 몇 개 + 서비스 워커로 — 첫 진입에 한꺼번에 받는다 (r322, `app/assetPacks`). 맨 끝에 둔다(산출물을 다 쓴 뒤 훑는다)
  plugins: [react(), vanillaExtractPlugin(), spriteJsonBundle(), versionedAssets(), assetPacks()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // 화면 흐름 테스트만 .tsx 다. 그 파일들은 머리에 `@vitest-environment jsdom` 을 적어 둔다.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // 실제 브라우저(CSS · z-index · zoom 이 실린다)에서 도는 시험은 따로 돈다 — `yarn test:browser` (vitest.browser.config.ts)
    exclude: [...configDefaults.exclude, 'src/**/*.browser.test.tsx'],
    // 나눠 받는 화면(`lazyScreen`)을 시험 전에 받아 둔다 — 화면이 첫 그림부터 곧바로 선다
    // 해금 표(`unlocks.json`)는 시험에서 원본 잠금으로 돌린다 — `originalUnlocksForTests`
    // 숨은 판정값(`balance.json`)도 시험에서는 원본 값으로 돌린다 — `originalBalanceForTests`
    // 원본 버그 고치기 표(`bugfixes.json`)도 시험에서는 원본 버그 그대로 — `originalBugfixesForTests`
    setupFiles: [
      'src/shared/lib/lazyScreen/preloadForTests.ts',
      'src/shared/config/unlocks/originalUnlocksForTests.ts',
      'src/shared/config/balance/originalBalanceForTests.ts',
      'src/shared/config/bugfixes/originalBugfixesForTests.ts',
    ],
    // 변환 결과를 디스크에 남겨 다시 돌릴 때 빠르게 한다
    fsModuleCache: true,
  },
})
