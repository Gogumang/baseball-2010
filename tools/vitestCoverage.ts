import type { CoverageV8Options } from 'vitest/node'

/**
 * **단위 시험 커버리지** (r365, `pnpm test:coverage`) — 줄 · 갈래 숫자만 본다. 보고서는 터미널 요약 + `coverage/index.html`.
 *
 * 임계값은 잰 숫자보다 조금 낮게 둔다 — 시험을 지우거나 시험 없는 코드가 크게 늘면 실패한다. 숫자가 오르면 같이 올린다.
 * 잰 값(r365, vitest 5.0.1 · v8 · 시험 868 파일): 줄 92.30% (43089/46683) · 갈래 82.58% (38579/46714).
 */
export const unitTestCoverage = {
  provider: 'v8',
  // `pnpm test` 에서는 끈다 — `--coverage` 를 줄 때만 잰다
  enabled: false,
  reporter: ['text-summary', 'html'],
  reportsDirectory: 'coverage',
  include: ['src/**/*.{ts,tsx}'],
  exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*ForTests.ts', 'src/**/*.css.ts', 'src/**/*.d.ts', 'src/shared/lib/testing/**'],
  thresholds: { lines: 92, branches: 82 },
} satisfies CoverageV8Options
