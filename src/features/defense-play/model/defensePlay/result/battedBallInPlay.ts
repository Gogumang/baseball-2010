import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'

/**
 * **쏜 패턴 없이 결과만 들고 온 호출**(시험·옛 화면)이 판을 돌릴 결과인가 — 안타·아웃.
 *
 * 실제 타석은 쏜 패턴이 결과 객체에 묶여 와 홈런까지 판을 돈다(`playOutcome.isBattedBallKind`). 패턴 없이 온 홈런은
 * 점수를 타석 쪽 규칙(옛 길)으로 정하고, 재생거리만 `homeRunPlayback.ts` 가 원본 패턴으로 같은 판을 돌려 만든다.
 */
export function isBattedBallInPlay(outcome: AtBatOutcome): boolean {
  return outcome.kind === '안타' || outcome.kind === '아웃'
}
