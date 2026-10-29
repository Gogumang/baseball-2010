import { configDefaults, defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { spriteJsonBundle } from './tools/viteSpriteJsonBundle.ts'
import { versionedAssets } from './tools/viteVersionedAssets.ts'
import { assetPacks } from './tools/viteAssetPacks.ts'
import { reactCompiler } from './tools/viteReactCompiler.ts'
import { unitTestGroups } from './tools/vitestProjects.ts'
import { unitTestCoverage } from './tools/vitestCoverage.ts'

const UNIT_TEST_INCLUDE = ['src/**/*.test.ts', 'src/**/*.test.tsx']
const UNIT_TEST_EXCLUDE = configDefaults.exclude
// 나눠 받는 화면(`lazyScreen`)을 시험 전에 받아 둔다 — 화면이 첫 그림부터 곧바로 선다
// 해금 표(`unlocks.json`)는 시험에서 원본 잠금으로 돌린다 — `originalUnlocksForTests`
// 숨은 판정값(`balance.json`)도 시험에서는 원본 값으로 돌린다 — `originalBalanceForTests`
// 원본 버그 고치기 표(`bugfixes.json`)도 시험에서는 원본 버그 그대로 — `originalBugfixesForTests`
const SETUP_FILES = [
  'src/shared/lib/lazyScreen/preloadForTests.ts',
  'src/shared/config/unlocks/originalUnlocksForTests.ts',
  'src/shared/config/balance/originalBalanceForTests.ts',
  'src/shared/config/bugfixes/originalBugfixesForTests.ts',
  'src/shared/lib/testing/quietCanvasForTests.ts',
]
// 격리를 끈 무리는 앞 파일이 남긴 모듈 상태를 파일마다 되돌린다
const RESET_MODULE_STATE = 'src/shared/lib/testing/resetModuleStateForTests.ts'
const FRESH_MODULES = 'src/shared/lib/testing/freshModulesForTests.ts'
const UNIT_TEST_GROUPS = unitTestGroups(fileURLToPath(new URL('.', import.meta.url)))

export default defineConfig({
  base: './',
  // 스프라이트 JSON 265개를 한 파일로 — `sprites/sprite-json.bundle.json` (r311 A5, `shared/lib/sprite/spriteJsonBundle`)
  // 빌드 산출물의 `public/` 을 `v/<내용 해시>/` 로 — 호스트가 오래 캐시해도 배포 뒤 옛 그림이 안 섞인다 (r318 A2, `shared/lib/assetUrl`)
  // 빌드 산출물 자산을 gzip 묶음 몇 개 + 서비스 워커로 — 첫 진입에 한꺼번에 받는다 (r322, `app/assetPacks`). 맨 끝에 둔다(산출물을 다 쓴 뒤 훑는다)
  // 화면 부품(`ui/`) 가운데 `'use memo'` 를 단 것만 React Compiler 로 자동 메모 — 게임 진행 훅은 뺀다 (r353, `tools/viteReactCompiler.ts`)
  plugins: [
    react(),
    reactCompiler(process.env['REACT_COMPILER_LOG'], process.env['REACT_COMPILER_MODE']),
    vanillaExtractPlugin(),
    spriteJsonBundle(),
    versionedAssets(),
    assetPacks(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    // 화면 흐름 테스트만 .tsx 다. 그 파일들은 머리에 `@vitest-environment happy-dom` 을 적어 둔다.
    // 고르는 파일(include · exclude)은 아래 `projects` 무리마다 적는다 — 뿌리에 두면 무리 설정과 배열이 합쳐진다
    // 변환 결과를 디스크에 남겨 다시 돌릴 때 빠르게 한다
    fsModuleCache: true,
    // `pnpm test:coverage` 에서만 잰다 — `tools/vitestCoverage.ts`
    coverage: unitTestCoverage,
    // 대부분은 워커 안에서 읽은 모듈을 나눠 쓰고(격리 끔), 모듈 바꿔치기 등으로 나누면 깨지는 것만 격리한다 — `tools/vitestProjects.ts`
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          isolate: false,
          setupFiles: [...SETUP_FILES, RESET_MODULE_STATE],
          include: UNIT_TEST_INCLUDE,
          exclude: [...UNIT_TEST_EXCLUDE, ...UNIT_TEST_GROUPS.dom, ...UNIT_TEST_GROUPS.isolated],
        },
      },
      { extends: true, test: { name: 'dom', isolate: false, setupFiles: [FRESH_MODULES, ...SETUP_FILES], include: [...UNIT_TEST_GROUPS.dom] } },
      // 격리 무리는 VM 맥락으로 — 파일마다 프로세스를 새로 띄우는 것(forks)보다 빠르다(29s → 17s)
      { extends: true, test: { name: 'isolated', pool: 'vmThreads', setupFiles: SETUP_FILES, include: [...UNIT_TEST_GROUPS.isolated] } },
    ],
  },
})
