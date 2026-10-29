import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 마무리 투입 굴림 `0xac360` — 참이면 새 투수를 **벤치 마지막**에서 고른다.
 * 확률은 `d_level.dat[0x36..0x3b]` = 45·35·50·60·60·30 % (P7 E2 확정).
 *
 * ⚠️ 이 굴림은 **마무리 상황이 아니고 벤치에 마선수가 있을 때만** 돈다 (V3-E 정정 · 0xb8a8d) —
 * `replacementPitcherSlotOf` 참고.
 *
 * 디스어셈 ac360~ac408: 0xb6c20(state,1)==1 && 0xb6c20(state,0)==1 → 0 (난수 없음) ·
 * 칸 k (inn==8 → 1 · inn==7 → 2 · 리드<0 → 3 · 0xa9888(루 위 주자)>1 → 4 · 리드==1 → 5 · 그 밖 0) ·
 * `d_level[0x36+k] > rand(0,100)` (0xbfa54) 이면 참. 사이의 0x1f1d8 은 `[r0+0xac]` 읽기뿐이다.
 */
export const CLOSER_ROLL_PERCENTS: readonly number[] = [45, 35, 50, 60, 60, 30]

/** 굴림 칸 k — 9회 → 1 · 8회 → 2 · 지는 중 → 3 · 주자 2명 이상 → 4 · 1점 차 리드 → 5 · 그 밖 0 */
export function closerRollIndexOf(input: { readonly inningIndex: number; readonly lead: number; readonly runnerCount: number }): number {
  if (input.inningIndex === 8) return 1
  if (input.inningIndex === 7) return 2
  if (input.lead < 0) return 3
  if (input.runnerCount > 1) return 4
  if (input.lead === 1) return 5
  return 0
}

export interface CloserRollInput {
  readonly inningIndex: number
  readonly lead: number
  readonly runnerCount: number
  /** 두 팀 다 CPU 조작이면 굴리지 않는다 (0xb6c20 — CPU 끼리 경기) */
  readonly bothTeamsAreCpu?: boolean
}

export function rollsCloser(input: CloserRollInput, random: RandomPort): boolean {
  if (input.bothTeamsAreCpu === true) return false
  const index = closerRollIndexOf(input)
  return random.rand(0, 100) < (CLOSER_ROLL_PERCENTS[index] ?? 0)
}
