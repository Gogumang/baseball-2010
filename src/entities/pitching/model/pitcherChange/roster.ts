import type { PitcherRole } from '@/entities/pitching/model/pitcherChange/otherSlices'

/**
 * **로스터 투수 칸별 보직** — `XlsPITCHER_DATA` 레코드 `+0xb & 3` (0xb6dec → 0xb6704 가 읽는 칸).
 * 레코드 0x30 바이트가 표 한 줄 그대로이고, 15팀 × 8줄 120줄이 **모두 팀 안 차례 [0,0,0,0,1,1,1,2]** 다
 * (`base/extracted/XlsPITCHER_DATA.json` 의 줄마다 바이트 11 을 풀어 확인 — 선발 넷 · 중간 셋 · 마무리 하나).
 * 웹 로스터도 이 바이트를 `RosterPlayer.profile`(+0xb)로 싣는다 — 120줄 모두 `profile & 3` 이 이 표와 같다(시험이 지킨다).
 * 칸 번호만으로 부르는 쪽(마투수 8번 · 내 투수 칸은 표 밖)이 많아 칸 표로 둔다.
 *
 * 선발 교체 0xb5e98(0↔k, k ≤ 3)·4인 로테이션은 선발끼리만 맞바꾸므로 칸의 보직이 그대로다.
 */
export const ROSTER_PITCHER_ROLES: readonly PitcherRole[] = [0, 0, 0, 0, 1, 1, 1, 2]

/** 로스터 투수 칸(팀 안 0~7)의 보직. 그 밖의 칸(마투수 8번 · 투수편의 내 투수 등)은 모른다 */
export function rosterPitcherRoleOf(slot: number): PitcherRole | undefined {
  return ROSTER_PITCHER_ROLES[slot]
}

/**
 * 능력 합 `0xb5b50(팀, P)` (b5b50~b5bb4, 확정): P 가 없으면 0, 아니면
 * `0xb570c(팀, k, P, 1, [sp]=90, [sp+4]=1)` 을 k = 0·1·2·3(제구·구속·변화·**체력**) 네 칸 더한 값.
 * 체력 인자 90 이라 피로(0xb58e6)는 없고, 팀 능력치·코치 정액과 0..999 자르기는 칸마다 먹는다 —
 * 곧 **경기용 능력치 네 칸(체력 인자 90)의 합**이다.
 */
export function pitcherAbilitySumOf(gameAbilities: readonly number[]): number {
  return (gameAbilities[0] ?? 0) + (gameAbilities[1] ?? 0) + (gameAbilities[2] ?? 0) + (gameAbilities[3] ?? 0)
}
