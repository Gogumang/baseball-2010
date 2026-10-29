import { PLAY_RECORD } from '@/entities/game/model/gameRecords/plays/playRecordIds'

/**
 * 5 대타 홈런 — 0xa8024 @a8764: 홈런 수(sp+0x24) > 0 이고 ctx+0x160 ≠ 0.
 * ctx+0x160 은 대타 교체 0xa5bf0(ctx, 0) 이 1 로 세우고(0xa5c1e, 공격 팀이 사람일 때만 —
 * 경기 상태 0x16 처리 0x3d458 → 0x3d57e), 타석 초기화 0xa5bcc 가 0 으로 지운다.
 * → "사람 팀이 대타를 낸 **그 타석** 의 홈런". 홈런 단계 1~4 와 **함께** 준다.
 * **순서 확정 (1e1f5f2)**: 교체 연출 0x16 다음은 0xd 인데, 그 진입 `0x48d50` 이 이전 상태(`scene+0x28`)가
 *    0x16 이면 카운트 지우기 `0xb6764` 와 타석 초기화 `0xa5bcc` 를 **건너뛴다** (48e94 `cmp r3,#0x16 ; beq 48eb8`).
 *    그래서 0x16 에서 세운 ctx+0x160 이 대타를 낸 그 타석 동안 살아 있고, 그 다음 새 타석의 0xd 가 지운다.
 *    (R8 5-3 이 "유력" 으로 남긴 "타석 초기화가 교체보다 먼저" 순서가 이것이다.)
 * 배선 자리: 팀 경기 `teamGameFlow` 의 `pinchHit`(세움) → `finishBatterOutcome`(홈런이면 5) — 1e1f5f2.
 *   gameFlow.ts 에는 **원본대로 없다**. 785796d 가 넣은 CPU 대타(`0xac228`)도 5 를 못 낸다 —
 *   ctx+0x160 을 1 로 세우는 0xa5bf0 은 호출지가 사람 경기 장면 상태 0x16(0x3d458 의 0x3d57e·0x3d64c)
 *   하나뿐이고(`re xref 0xa5bf0`), 간이 엔진 루프 0xc262c 는 0xc1ba4(→ 0xac228 대타, 0xc2662) 뒤
 *   0xa5bcc(0xc26b6)로 플래그를 **지우기만** 한다. 사람 타석 시작 0x3d954 가 0xac228 을 부르는 갈래는
 *   수비 팀이 사람일 때(state[0x31+state[0xa]] ≠ 1, 0x3d9e4)뿐이라 그때 공격 팀은 CPU 이고,
 *   0xa5bf0(ctx, 0) 은 공격 팀이 사람이 아니면 세우지 않는다(0xa5c0a~0xa5c1c).
 *   → 사람 팀이 **사람 경기 장면에서 낸 대타**만 5 를 받는다.
 */
export function pinchHitHomeRunRecordIdsOf(input: {
  readonly isHomeRun: boolean
  /** 이 타석이 사람 팀이 낸 대타의 타석인가 (ctx+0x160) */
  readonly isPinchHitAtBat: boolean
}): number[] {
  return input.isHomeRun && input.isPinchHitAtBat ? [PLAY_RECORD.pinchHitHomeRun] : []
}

export interface BackToBackInput {
  /** 지금까지 이어진 사람 팀 연속 홈런 수 (ctx+0x162) */
  readonly streak: number
  /** 이 타석의 공격 팀이 사람 팀인가 (state[0x31 + state[9]] == 0) */
  readonly humanOffense: boolean
  readonly isHomeRun: boolean
}

/**
 * 6 백투백 · 7 백투백투백 — 0xa794c(@a797e·a798a), 카운터 ctx+0x162 (s8).
 *   홈런 타석(0xa8024 @a8606 이 부름): 공격 팀이 사람이면 ++ → 2 면 6, 3 이면 7 을 주고 0 으로.
 *                                      사람이 아니면 0.
 *   홈런 아닌 결과로 끝난 타석: 공격 팀과 무관하게 0 — 안타 @a86b4 · 범타·삼진 @a8ab2 · 볼넷 @a8b7e ·
 *                                      사구 @a8bf8.
 * 3연속이면 두 번째에 6, 세 번째에 7. 7 뒤 0 으로 돌아가므로 다섯 번째 연속 홈런에서 다시 6.
 * 도루 같은 주자 플레이(종류 5, 타석 완료 아님)는 카운터를 건드리지 않는다 — 이 함수를 부르지 말 것.
 * 배선: gameFlow.ts `finishPlayerOutcome`(사용자 타석)과 `playTeammateAtBat`(동료 타석 — 간이 엔진도
 *   0xa8024 를 지난다)에서 humanOffense = true 로, `playOpponentInning` 의 상대 타석마다 humanOffense = false
 *   로 부른다. 카운터는 `GameProgress.homeRunStreak` 한 칸(팀 단위)이다.
 */
export function backToBackRecordOf(input: BackToBackInput): { readonly streak: number; readonly recordIds: number[] } {
  if (!input.isHomeRun || !input.humanOffense) return { streak: 0, recordIds: [] }
  const streak = input.streak + 1
  if (streak === 2) return { streak, recordIds: [PLAY_RECORD.backToBack] }
  if (streak === 3) return { streak: 0, recordIds: [PLAY_RECORD.backToBackToBack] }
  return { streak, recordIds: [] }
}

/**
 * 32 3연속 파울 · 33 4연속 파울 — 0xa7dbc @a7dda (확인). 파울 한 개마다 ctx+0x15f 를 올리고
 * 3 이 되면 32, 4 가 되면 33. 5 번째부터는 아무것도 없고 4 에서 되돌리지도 않는다.
 * 부르는 곳은 사람 타석 판정 0x51408 의 v = 7(파울) 갈래 하나뿐 → 간이 엔진 동료 타석에서는 안 나온다.
 * 0 으로: 타석 초기화 0xa5bcc, 그리고 공 도착 판정 0x3dfac 끝의 0xa5fdc → 파울 아닌 공이 오면 끊긴다
 *   (r126 확정 — 0x3dfac 의 출구는 0x3e1fa 의 pop 하나뿐이고, 0x3e064·0x3e068·0x3e06c → 0x3e0e4 ·
 *   0x3e0a4 → 0x3e11a · 점프표 0xcffb4 열세 칸(0x3e134·0x3e156·0x3e15e·0x3e196·0x3e1ae·0x3e1b4·0x3e1d4) 모두
 *   0x3e1d4 → 0x3e1ec 를 지나 0x3e1f6 에서 0xa5fdc(ctx) 를 부른다. 리셋은 부르는 쪽이 0 을 넘겨 한다).
 * 게이트상 사람 공격 때만.
 * 배선: 공마다 `features/play-at-bat/model/atBatPitchTally.tallyPitch` 가 부르고(파울 아닌 공이면 0 으로),
 *   모인 id 를 `startPlayerOutcome`(·`applyPlayerOutcome`) 의 `foulRecordIds` 로 넘기면 gameFlow 가 얹는다.
 *   동료 타석(`playTeammateAtBat`)에는 붙이지 않는다.
 */
export function foulRecordOf(foulStreak: number): { readonly foulStreak: number; readonly recordIds: number[] } {
  const next = foulStreak + 1
  if (next === 3) return { foulStreak: next, recordIds: [PLAY_RECORD.threeFouls] }
  if (next === 4) return { foulStreak: next, recordIds: [PLAY_RECORD.fourFouls] }
  return { foulStreak: next, recordIds: [] }
}
