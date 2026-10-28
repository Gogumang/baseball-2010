import { ORIGINAL_BUGFIX_CONFIG, setBugfixConfigForTests } from '@/shared/config/bugfixes/bugfixes'

/**
 * 시험 준비 파일(vitest `setupFiles`) — 시험은 **원본 버그 그대로** 돈다. 지금까지의 시험(원본 대조 · soak · 시드 고정 결과)은
 * 원본 동작을 전제로 짜였고, `bugfixes.json` 을 고쳐도 흔들리지 않아야 한다.
 * 고친 길을 보는 시험은 `setBugfixConfigForTests(bugfixConfigWith(['B-xx']))` 로 켜고 끝나면 `ORIGINAL_BUGFIX_CONFIG` 로 되돌린다.
 *
 * 고친 길로 시드 측정을 돌릴 때만 `BUGFIXES=json` 을 준다 — 그때는 `bugfixes.json` 그대로 돈다
 * (예: `BUGFIXES=json pnpm vitest run <시험 파일> --maxWorkers=2`).
 */
// 브라우저 시험(`vitest.browser.config.ts`)에는 `process` 가 없다 — 그때는 늘 원본
const useJson = typeof process !== 'undefined' && process.env.BUGFIXES === 'json'
setBugfixConfigForTests(useJson ? null : ORIGINAL_BUGFIX_CONFIG)
