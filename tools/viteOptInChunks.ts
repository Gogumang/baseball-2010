import type { Plugin } from 'vite'

/**
 * **골라 켜는 덩이는 따로 폴더로** (r380 — 웹 전용, 원본에 없다).
 *
 * 배포판에서 `?vitals` 를 붙였을 때만 받는 성능 표시 덩이(web-vitals · stats.js — `app/devtools/vitalsOverlay` ·
 * `statsOverlay`)를 `assets/` 대신 `assets/opt/` 에 낸다. 크기 상한(`.size-limit.js`)의 "전체 JS" 는 `dist/assets/*.js`
 * 라 하위 폴더를 세지 않는다 — 보통 손님이 받지 않는 덩이가 상한을 먹지 않게.
 *
 * - 받는 때는 그대로: 첫 진입 덩이의 동적 import 주소만 `./opt/…` 로 바뀐다(`?vitals` 일 때만 받는다).
 * - 캐시 · 자산 묶음은 그대로: `vercel.json` 의 `/assets/(.*)` 가 하위 폴더도 덮고, 자산 묶음(`viteAssetPacks`)은 산출물을 하위 폴더까지 훑는다.
 * 시험(vitest)에는 붙지 않는다(`apply: 'build'`).
 */
const OPT_IN_CHUNK_DIR = 'assets/opt'

const OPT_IN_MODULE = /[\\/]src[\\/]app[\\/]devtools[\\/](vitalsOverlay|statsOverlay)\.ts$/

const DEFAULT_CHUNK_FILE_NAME = 'assets/[name]-[hash].js'
const OPT_IN_CHUNK_FILE_NAME = `${OPT_IN_CHUNK_DIR}/[name]-[hash].js`

function chunkFileNameOf(facadeModuleId: string | null): string {
  const isOptIn = facadeModuleId !== null && OPT_IN_MODULE.test(facadeModuleId)
  return isOptIn ? OPT_IN_CHUNK_FILE_NAME : DEFAULT_CHUNK_FILE_NAME
}

export function optInChunks(): Plugin {
  return {
    name: 'opt-in-chunks',
    apply: 'build',
    config: () => ({
      build: {
        rolldownOptions: {
          output: { chunkFileNames: (chunk: { readonly facadeModuleId: string | null }) => chunkFileNameOf(chunk.facadeModuleId) },
        },
      },
    }),
  }
}
