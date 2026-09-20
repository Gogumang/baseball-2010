import { ORIGINAL_BURST_TABLES } from '@/shared/config/original/burstMissions'

/**
 * 돌발미션 표 한 행 (binary.mod `data/XlsBATTER_BURST.zt1` 0xd50b4 · `XlsPITCHER_BURST` 0xd50d0 ·
 * `XlsSEASON_BURST` 0xd50ec, 로더 0x8e1b0 — K-bursts-special.md 4절 1-0·1-1, 확정).
 *
 * 행 크기 16바이트, 열 16개가 모두 u8(타입 0)이다. 값 −1(무관)은 바이트 0xff 로 들어 있어
 * **읽을 때 부호 있는 바이트로 본다**.
 *
 * | 열 | 뜻 |
 * |---|---|
 * | b0 | 상황 (0 항상 · 1 상대 클린업 · 2 역전찬스 · 10~22 상대가 그 마선수) |
 * | b1·b2·b3 | 1·2·3루: −1 무관 · 0 비어야 · 1 있어야 (b0 == 2 면 건너뜀, 0x8ede8) |
 * | b4 | 아웃 수 (−1 무관, 0x8ec3c) |
 * | b5 | 점수차 (0 무관 · +k 이기는 중 1~k · −k 지는 중 1~k, 0x8ed50) |
 * | b6·b7 | 이번 경기 기록 조건 (1 안타 · 2 홈런 · 3 탈삼진 == b7, 0x8ec9c) |
 * | b8 | 목표 (0x8f414 의 점프표 0xd525c) |
 * | b9 | 발동 확률 % (0x8ec64) |
 * | (b10,b11) (b12,b13) | 성공 보상 두 개 (종류, 양) — 0x8e34c |
 * | (b14,b15) | 실패 페널티 (종류, 양). b14 == 0 이면 없다 |
 */

/** 원본 게임 모드 (0x1552d10) — 돌발미션은 이 셋에서만 만들어진다 (0x48658 의 `모드−2 ≤ 2`, 0x48c08) */
export const BURST_MODE = {
  시즌: 2,
  나리투수: 3,
  나리타자: 4,
} as const

export type BurstTableName = 'BATTER' | 'PITCHER' | 'SEASON'

/** 모드 → 표. 4 → BATTER(40행) · 3 → PITCHER(44행) · 2 → SEASON(56행) (로더 0x8e1b0) */
export function burstTableNameOf(mode: number): BurstTableName | null {
  if (mode === BURST_MODE.나리타자) return 'BATTER'
  if (mode === BURST_MODE.나리투수) return 'PITCHER'
  if (mode === BURST_MODE.시즌) return 'SEASON'
  return null
}

/** 표별 행 수 (K 4절 1-0, 확정). 생성기가 뽑아 온 표가 이 길이인지 확인하는 데 쓴다 */
export const BURST_ROW_COUNTS: Readonly<Record<BurstTableName, number>> = {
  BATTER: 40,
  PITCHER: 44,
  SEASON: 56,
}

/** 시즌 표는 반씩 나뉜다 — 사람 팀이 공격이면 행 0~30(타자형), 수비면 31~55(투수형) (0x8f000) */
export const SEASON_BATTING_ROWS = { from: 0, to: 30 } as const
export const SEASON_FIELDING_ROWS = { from: 31, to: 55 } as const

export interface BurstReward {
  /** 1 사기 · 2 인기도 · 3 평판 · 4 소지금 (0x8e3ae 스위치). 0 이면 없음 */
  readonly kind: number
  readonly amount: number
}

export interface BurstMissionRow {
  /** 표 안의 행 번호 (0-기준) */
  readonly index: number
  /** b0 */
  readonly situation: number
  /** b1·b2·b3 — 1·2·3루 순서. −1 무관 · 0 비어야 · 1 있어야 */
  readonly bases: readonly [number, number, number]
  /** b4 — −1 이면 무관 */
  readonly outs: number
  /** b5 */
  readonly scoreDifference: number
  /** b6 — 0 무관 · 1 안타 · 2 홈런 · 3 탈삼진 */
  readonly recordKind: number
  /** b7 — 비교할 개수 */
  readonly recordCount: number
  /** b8 */
  readonly goal: number
  /** b9 */
  readonly chancePercent: number
  /** (b10,b11)·(b12,b13) — 성공하면 둘 다 **더한다** */
  readonly successRewards: readonly [BurstReward, BurstReward]
  /** (b14,b15) — 실패하면 **뺀다**. kind 0 이면 아무것도 안 한다 */
  readonly failurePenalty: BurstReward
}

const ROW_BYTES = 16

/** u8 을 부호 있는 바이트로 본다 — 원본이 −1(무관)을 0xff 로 담아 둔다 */
function asSignedByte(value: number): number {
  return value > 127 ? value - 256 : value
}

/**
 * 원시 16바이트 한 줄을 행으로 푼다.
 *
 * 부호 있는 바이트로 읽는 칸은 **조건 칸(b1~b5)뿐**이다. 보상 양(b11·b13·b15)은 원본이
 * 부호 없이 읽어 더하고 빼므로(0x8e34c) 그대로 둔다.
 */
export function decodeBurstRow(bytes: readonly number[], index: number): BurstMissionRow {
  if (bytes.length !== ROW_BYTES) {
    throw new Error(`돌발미션 행은 16바이트다 (행 ${index}, 받은 길이 ${bytes.length})`)
  }
  const byte = (offset: number) => bytes[offset] ?? 0
  return {
    index,
    situation: byte(0),
    bases: [asSignedByte(byte(1)), asSignedByte(byte(2)), asSignedByte(byte(3))],
    outs: asSignedByte(byte(4)),
    scoreDifference: asSignedByte(byte(5)),
    recordKind: byte(6),
    recordCount: byte(7),
    goal: byte(8),
    chancePercent: byte(9),
    successRewards: [
      { kind: byte(10), amount: byte(11) },
      { kind: byte(12), amount: byte(13) },
    ],
    failurePenalty: { kind: byte(14), amount: byte(15) },
  }
}

function decodeBurstTable(name: BurstTableName): readonly BurstMissionRow[] {
  return ORIGINAL_BURST_TABLES[name].rowBytes.map((bytes, index) => decodeBurstRow(bytes, index))
}

/**
 * 원본 표 140행 (`data/XlsBATTER_BURST.zt1` 40 · `XlsPITCHER_BURST.zt1` 44 ·
 * `XlsSEASON_BURST.zt1` 56 — 로더 0x8e1b0).
 *
 * 값은 `tools/generate_game_data.py` 가 원시 .zt1 에서 뽑아 둔
 * `shared/config/original/data/burstMissions.json` 의 **행 16바이트 그대로**이고, 뜻은 여기서
 * `decodeBurstRow` 가 입힌다. 표 순서는 원본 파일 순서다 — 발동 때 행마다 주사위를 굴리므로
 * (`burstMissionTrigger.ts` 의 `rollBurstRow`) **순서를 바꾸면 난수 소비가 달라진다.**
 *
 * 대사 4줄(0 제안 · 1 성공 · 2 실패 · 3 무효)은 같은 JSON 의 `lines` 에 행 번호로 짝지어 있다.
 */
export const BURST_TABLES: Readonly<Record<BurstTableName, readonly BurstMissionRow[]>> = {
  BATTER: decodeBurstTable('BATTER'),
  PITCHER: decodeBurstTable('PITCHER'),
  SEASON: decodeBurstTable('SEASON'),
}

/**
 * 이번 타석에서 후보가 될 수 있는 행들 (0x8f000 앞부분).
 * 시즌 모드만 반씩 나뉜다 — `game[0x31 + game[0xa]] == 0`(사람 팀이 공격) 이면 0~30, 아니면 31~55.
 */
export function burstRowsFor(
  mode: number,
  isHumanTeamBatting: boolean,
  tables: Readonly<Record<BurstTableName, readonly BurstMissionRow[]>> = BURST_TABLES,
): readonly BurstMissionRow[] {
  const name = burstTableNameOf(mode)
  if (name === null) return []
  const rows = tables[name]
  if (name !== 'SEASON') return rows
  const range = isHumanTeamBatting ? SEASON_BATTING_ROWS : SEASON_FIELDING_ROWS
  return rows.slice(range.from, range.to + 1)
}
