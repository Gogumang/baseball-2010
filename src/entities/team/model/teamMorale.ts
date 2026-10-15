import { TEAMS } from '@/shared/config/original/teams'

/**
 * **팀 레코드 사기** — 모드별 팀 레코드 s16 `+2` (XlsTEAM_DATA 행의 둘째 u16). 표에서는 전 팀이 100 이다.
 *
 * 스태미나 용량 `0x66e44(V, P, f)` 의 `V[+2]` 가 이 칸이다 — `V = 0x1f9a8(전역, 모드 = state[1], 팀+0x25)` 로 **그 투수 팀의**
 * 레코드를 찾으므로(0xaeb08, P1 3-2) 상대 팀 투수는 상대 팀 레코드의 사기를 쓴다. 모드 3·4(나리)는 `0x1f940`(전역+0xb8) 의
 * 팀 레코드다. 투수편 내 팀 사기(`pitcherGameOptions.teamMoraleOf`)도 같은 칸이다.
 *
 * **모드 3·4 의 팀 레코드 +2 를 바꾸는 곳 (확정, 2026-10 r87 · r96 직접 뜸)**:
 * - 나리 사기 쓰기 `0xa3a44(R, v)`(0..100 으로 잘라 a3a64 `strh [0x1f988(저장, R[1]), #2]`) — `0x1f988` 은 `[저장+0x40]`(3 → `0x1f940` ·
 *   4 → `0x1f8f8`)로 **내 팀 칸**을 고르고, 사기 읽기 `0xa3a24` 도 같은 칸을 읽는다 — 곧 나리 **커리어 사기가 내 팀 레코드 +2 그 자체**다.
 * - 경기 장면 셋업 0x39fdc 3a2f8~3a332 — `0xb8680(내 팀 객체)` 의 레코드 +2 = `0xa3a24(R)`(0..100).
 * - **실효 능력치 0xb570c 모드 3 · 4 갈래 b574a~b5768** — 넷째 인자 ≠ 0 이면 첫 인자(부르는 쪽이 `0xb8680(팀 객체)` 로 넘긴 **아무
 *   팀의** 레코드) +2 = `0xa3a24(R)` 를 쓰고, 사기 감소(b57c4)가 그 칸을 읽는다. 투구 · 타격 화면과 간이 엔진(0xc11f0 c1308 · c1320 은
 *   두 팀 모두)이 공마다 부른다 → 경기에 선 **상대 팀 칸도** 나리 사기가 된다. (r87 은 `0x1f9a8` 들의 반환값 뒤 strh 만 훑어 이 쓰기를
 *   못 보고 "상대 = 표값" 으로 적었다 — r96 에서 바로잡음)
 * 그래서 웹은 나리 경기의 두 팀 사기 = 지금 나리 사기(`entities/career/model/nariMorale` 의 `nariMoraleOf` — `GameProgress.teamMorale` ·
 * `pitcherGameOptionsOf` · CPU 끼리 경기 `LeagueAbilityContext.nariMorale`)다. 표값은 일반 · 대전 · 미션처럼 그 쓰기가 없는 모드의 것이다.
 *
 * ⚠️ 원본 버그(r96 반영): 나리 국가대항전 중(R+0x12c ≠ 0)에는 `0x1f940` · `0x1f8f8` 이 팀 10 → 대표팀 칸 +0xbc4, **그 밖 팀 →
 * 상대국 칸 +0xbe0** 을 돌려준다(1f95e~1f97a). R[1] 은 대한민국(10)이 아니라 내 리그 팀이라 대회 동안 `0xa3a24` · `0xa3a44` 는
 * 상대국 칸 +2 를 읽고 쓴다 — 그 칸은 대회 시작 0xb7bf0(b7ca4) · 하루 끝 0xb818c(b8216)마다 `0x20648` 이 마스터에서 새로 복사한다
 * (`NariCupTeams.opponentMorale`, `nariMoraleOf`).
 *
 * **모드 2(시즌)의 팀 레코드 +2** (r101 직접 뜸 — `0x1f570` 부르는 곳 전수): 시즌 사기는 `0x1f570(저장, SR[1])` 내 팀 레코드 +2 다.
 * 경기 중 쓰기는 돌발 보상 0x8e34c 종류 1 하나(8e3d2~8e404 `0x1f9a8(저장, 2, SR[1])` → 0x1f570 → +2 에 ±양, 0..100)이고,
 * 0xb570c 시즌 갈래(b5804)는 읽기만 한다. `0x1f570` 은 국가대항전 중(S+0x12c ≠ 0) 팀 10 → +0x918, **그 밖 → 상대국 슬롯 +0x934**
 * (1f58a~1f5a4)라 대회 중 돌발 사기는 리그 칸이 아니라 그날 상대국 칸 +2 에 쌓인다(원본 버그 — `TeamGameOptions.opponentTeamMorale`).
 */
const TEAM_MORALE_VALUE_INDEX = 1
export const DEFAULT_TEAM_MORALE = 100

export function teamRecordMoraleOf(teamId: number): number {
  return TEAMS[teamId]?.values[TEAM_MORALE_VALUE_INDEX] ?? DEFAULT_TEAM_MORALE
}

/** 팀 레코드 사기 상한 — 8e3f6 `cmp r2, #0x64` */
const MORALE_MAXIMUM = 100

/** 사기 쪽 돌발 보상 한 줄 — `BurstRewardDelta` 와 같은 꼴 */
interface MoraleDelta {
  readonly name: string
  readonly amount: number
}

/**
 * 돌발 보상 · 페널티 0x8e34c 종류 1(사기)을 한 팀 레코드 +2 에 차례로 먹인 값 — 줄마다 0..100 으로 자른다
 * (시즌 8e3f0~8e404 · 8e4f0~8e506, 나리 8e410~8e422 · 8e512~8e524 의 0xa3a44). 다른 종류는 건너뛴다
 */
export function teamRecordMoraleAfterBurst(start: number, deltas: readonly MoraleDelta[]): number {
  return deltas.reduce(
    (morale, delta) => (delta.name === '사기' ? Math.min(MORALE_MAXIMUM, Math.max(0, morale + delta.amount)) : morale),
    start,
  )
}
