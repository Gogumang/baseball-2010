import { PLAY_RECORD } from '@/entities/game/model/gameRecords/plays/playRecordIds'

/**
 * 26 더블플레이 · 27 트리플플레이 — 0xa8024 @a8e70 · @a8e84 (0xa8e58~0xa8e84 확인).
 * 아웃 수 = 이 플레이 이벤트 목록의 삼진(5)·아웃(0xd) 개수 — 목록은 **투구마다** 비워진다(0xa5e80),
 * 그러니 "공 하나로 생긴 플레이" 의 아웃 수다.
 *   아웃 2 → 주자 달리는 중 삼진(state[0x1a], 0xb6c3c)이 아니면 26 · 아웃 3 → 27 (state[0x1a] 와 무관)
 * 플레이 종류와 무관하게 매 정산 본다. 게이트상 사람 수비 때만 남는다.
 * 배선 자리: gameFlow.ts 에는 **붙이지 않는다** — `playOpponentInning` 은 간이 엔진이라 한 타석 아웃이
 *   하나다(E-9), 사용자 타석의 병살은 사람 공격이라 게이트에서 버려진다. 사람 수비 화면(투수편 pitcherGameFlow,
 *   팀 경기 수비)의 플레이 정산에서 outsInPlay 로 부른다.
 */
export function multiOutPlayRecordIdsOf(input: {
  readonly outsInPlay: number
  /** state[0x1a] — 주자가 달리는 중 나온 삼진 (P7 E3) */
  readonly strikeoutWhileRunning: boolean
}): number[] {
  if (input.outsInPlay === 2) return input.strikeoutWhileRunning ? [] : [PLAY_RECORD.doublePlay]
  if (input.outsInPlay === 3) return [PLAY_RECORD.triplePlay]
  return []
}

/**
 * 36 필살송구 아웃 — 0xa8024 @a810c (0xa80f8~0xa8116 확인, R3 5절).
 * 이 플레이 아웃 수(sp+0x30) > 0 이고 state[0x8b](레이저 송구 뒤 아웃 결과)가 서 있으면 36 을 주고
 * state[0x8b] 를 0 으로. **아웃이 없으면 플래그를 지우지 않는다** — 지우는 strb 가 BL 뒤에만 있다.
 * 게이트상 사람 수비 때만, 사람 수비 화면이 있어야 한다.
 * 배선 자리: gameFlow.ts 에는 **붙이지 않는다**(타자편 수비는 간이 엔진, 내 타석의 CPU 송구는 게이트에서 버려진다). 사람 수비 플레이 정산(투수편·팀 경기 수비)에서
 *   돌려받은 laserThrowFlag 를 상태에 되돌려 둔다.
 */
export function laserThrowOutRecordOf(input: {
  /** state[0x8b] */
  readonly laserThrowFlag: boolean
  readonly outsInPlay: number
}): { readonly laserThrowFlag: boolean; readonly recordIds: number[] } {
  if (input.outsInPlay > 0 && input.laserThrowFlag) {
    return { laserThrowFlag: false, recordIds: [PLAY_RECORD.laserThrowOut] }
  }
  return { laserThrowFlag: input.laserThrowFlag, recordIds: [] }
}
