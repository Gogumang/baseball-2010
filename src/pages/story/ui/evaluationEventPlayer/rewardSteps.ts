import type { RewardNotice } from '@/entities/story/model/rewardNotice'

/**
 * 평가 내장 이벤트를 차례로 튼다 — 명령 1 say → 명령 2 system sub 2(변화 창) → (있으면) 명령 3 say(연속 기록)
 * → (있으면) 보상 명령(종류 7)들 → (있으면) 마지막 system sub 5 알림 창
 */
export type EvaluationStep = '대사' | '변화' | '연속기록' | '보상' | '알림'

/** 창 없이 지나가는 보상 명령(첫 종류 7 인데 글을 못 짓는 id 등 — 평가 이벤트에는 없다)은 건너뛴다 — `index` 부터 창이 서는 첫 명령 */
export function nextWindowRewardOf(notices: readonly RewardNotice[], index: number): number {
  let at = index
  while (at < notices.length && notices[at]?.kind !== '알림' && notices[at]?.kind !== '스킬') at += 1
  return at
}

/** 이미 준 보상 명령 수 — 보상 창이 선 갱신에 그 명령의 보상이 들어간다(0x8c460). 알림(system sub 5)이면 모두 준 뒤다 */
export function givenRewardCountOf(step: EvaluationStep, rewardIndex: number, total: number): number {
  if (step === '보상') return rewardIndex + 1
  return step === '알림' ? total : 0
}
