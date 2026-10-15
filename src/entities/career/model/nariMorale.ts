import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import type { BurstRewardDelta } from '@/entities/burst-mission/model/burstMissionReward'
import type { NariCupTeams } from '@/entities/career/model/nariCupTeams'
import { DEFAULT_TEAM_MORALE, teamRecordMoraleOf } from '@/entities/team/model/teamMorale'
import { BALANCE } from '@/shared/config/original/balance'

/**
 * **나리 사기 읽기 · 쓰기** `0xa3a24` · `0xa3a44` — 사기는 선수 레코드가 아니라 **팀 레코드 +2** 에 있다 (직접 떴다).
 * ```
 * 0xa3a24(R)      0x1f989(전역, R[1]) → ldrsh [레코드, #2]
 * 0xa3a44(R, v)   0x1f989(전역, R[1]) → v 를 0..100 으로 잘라 a3a64 strh [레코드, #2]
 * 0x1f988(g, 팀)  [g+0x40](편) 3 → 0x1f940 · 4 → 0x1f8f8 (그 밖 0)
 * 0x1f940 / 0x1f8f8(g, 팀)   [g+0xb8] / [g+0xbc] 블록. 0x1f8d4(g, 편) +0x12c(국가대항전, S+0x12c) ≠ 0 이면
 *                 1f964~1f970: 팀 == 10 → +0xbc4(대표팀) · **그 밖 → +0xbe0(상대국)** · 아니면 +4 + 0x1c·팀
 * ```
 * R[1] 은 늘 내 **리그 팀**(0~9)이라 대회 중(S+0x12c ≠ 0)에는 두 함수가 **상대국 칸 +0xbe0 의 +2** 를 읽고 쓴다 — ⚠️ 원본 버그 그대로 옮긴다.
 * 그 칸은 대회 초기화 0xb7bf0(b7ca4) · 하루 끝 0xb818c(b8216)의 `0x20648` 이 마스터 팀 레코드를 통째(0x1fe5c) 새로 복사하므로
 * 날마다 그 상대국 표값(전 팀 100)으로 돌아가고, 리그 칸의 사기는 대회 동안 그대로 남는다(새 시즌 0x1b768 은 S+0x12c = 0 (1b774)
 * 뒤에 1b790 `0xa3a44(R, 100)` 으로 리그 칸을 100 으로 놓는다).
 *
 * 대회 중 사기를 읽고 쓰는 길: 경기 장면 셋업 0x39fdc(3a31e — 읽어서 내 팀 레코드 +2 에 씀) · 실효 능력치 0xb570c(b5762 — 읽어서
 * 넘겨 받은 팀 레코드 +2 에 쓴 뒤 사기 감소가 그 칸을 읽음) · 경기 중 돌발 보상 0x8e34c(8e410 · 8e420 · 8e512 · 8e522 종류 1).
 * 그 밖의 0xa3a24 · 0xa3a44 부르는 곳(훈련 · 휴식 · 외출 · GP 아이템 · 평가 0xa719c · 이벤트 보상 0x8c460 · 관리 화면)은 대회 흐름
 * (133 → 134 → 135 → 142 → 경기 → 0x4ea0c → 134)에서 돌지 않는다 — 평가 0xa719c 는 0x4ea0c 4f216 이 건너뛰고, 133 의
 * 461 ~ 463 이벤트 보상에는 사기(종류 2)가 없다.
 */

/** 이 둘을 든 커리어 — 타자편 `PlayerCareer` · 투수편 `PitcherCareer` 가 같은 이름으로 든다 */
export interface NariMoraleCareer {
  /** 리그 내 팀 레코드 +2 — 커리어 사기 */
  readonly morale: number
  /** S+0x12c — 있으면 대회 중 */
  readonly nationalCup?: NationalCup
  /** 대회 레코드 두 칸 — 상대국 칸 +2 가 대회 중 사기다 */
  readonly nariCupTeams?: NariCupTeams
}

const MAXIMUM_MORALE = BALANCE.limits.morale

/** 0xa3a24 — 지금 나리 사기. 대회 중이면 상대국 칸 +2 (없으면 마스터 복사 표값) */
export function nariMoraleOf(career: NariMoraleCareer): number {
  if (career.nationalCup === undefined) return career.morale
  const teams = career.nariCupTeams
  if (teams === undefined) return DEFAULT_TEAM_MORALE
  return teams.opponentMorale ?? teamRecordMoraleOf(teams.opponentTeamId)
}

/** 0xa3a44 — 나리 사기를 v 로(0..100 으로 자른다). 대회 중이면 상대국 칸 +2 에 쓰고 커리어 사기는 그대로다 */
export function withNariMorale<T extends NariMoraleCareer>(career: T, value: number): T {
  const clamped = Math.min(MAXIMUM_MORALE, Math.max(0, value))
  if (career.nationalCup === undefined) return career.morale === clamped ? career : { ...career, morale: clamped }
  const teams = career.nariCupTeams
  // 대회 칸은 142 준비(`prepareNariCupMatch`)가 경기 전에 세운다 — 칸이 없으면 쓸 자리가 없다
  if (teams === undefined) return career
  return { ...career, nariCupTeams: { ...teams, opponentMorale: clamped } }
}

/**
 * 경기용 실효 능력치의 사기 — 0xb570c 모드 3 · 4 갈래는 b5762 에서 **0xa3a24 를 읽어 넘겨 받은 팀 레코드 +2 에 쓰고**(b5768)
 * 사기 감소(b57c4)가 그 칸을 읽는다. 곧 내 선수의 경기 능력치는 늘 지금 나리 사기(`nariMoraleOf`)로 깎인다 — 대회 중이면 상대국 칸 값이다.
 * 커리어의 사기만 그 값으로 바꾼 사본을 돌려준다(능력치 함수에 넘길 것)
 */
export function withNariGameMorale<T extends NariMoraleCareer>(career: T): T {
  const morale = nariMoraleOf(career)
  return morale === career.morale ? career : { ...career, morale }
}

/**
 * 돌발 보상 · 페널티(0x8e34c)의 사기(종류 1)만 차례로 먹인 나리 사기 — 8e410 `0xa3a24` + 양 → 8e420 `0xa3a44`(0..100).
 * 경기 끝에 같은 날 CPU 경기(대회 0xc2dac)가 볼 사기를 진행기 밖에서 셀 때 쓴다
 */
export function nariMoraleAfterBurst(start: number, deltas: readonly BurstRewardDelta[]): number {
  return deltas.reduce(
    (morale, delta) => (delta.name === '사기' ? Math.min(MAXIMUM_MORALE, Math.max(0, morale + delta.amount)) : morale),
    start,
  )
}
