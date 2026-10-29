import { PLAY_RECORD } from '@/entities/game/model/gameRecords/plays/playRecordIds'

/** 게이트를 건너뛰는 번호 — 28~31 완투 계열 · 37~39 점수차 승 (0xa7818 의 마스크 0xe0f, k − 28) */
const UNGATED_RECORD_MASK = 0xe0f
const UNGATED_RECORD_FROM = 28
const LAST_OFFENSE_ONLY_RECORD = 15
const FIRST_LATE_OFFENSE_RECORD = 32
const LAST_RECORD = 39
const FIRST_DEFENSE_RECORD = 16
const LAST_DEFENSE_RECORD = 31

/** 28~31 · 37~39 — 마스크 0xe0f 에 선 번호는 게이트를 건너뛴다 */
function isUngatedRecord(recordId: number): boolean {
  const shifted = recordId - UNGATED_RECORD_FROM
  return shifted >= 0 && shifted <= LAST_RECORD - UNGATED_RECORD_FROM && ((1 << shifted) & UNGATED_RECORD_MASK) !== 0
}

/** 사람 공격 쪽 — k ≤ 15 또는 32 ≤ k ≤ 39, 단 36 은 아님 */
function isOffenseRecord(recordId: number): boolean {
  if (recordId === PLAY_RECORD.laserThrowOut) return false
  return (recordId >= 0 && recordId <= LAST_OFFENSE_ONLY_RECORD) || (recordId >= FIRST_LATE_OFFENSE_RECORD && recordId <= LAST_RECORD)
}

/** 사람 수비 쪽 — 16 ≤ k ≤ 31 또는 k == 36 */
function isDefenseRecord(recordId: number): boolean {
  return (recordId >= FIRST_DEFENSE_RECORD && recordId <= LAST_DEFENSE_RECORD) || recordId === PLAY_RECORD.laserThrowOut
}

/**
 * 지급 게이트 0xa77f0 의 팀 방향 (R8 1절 — a7818 · a785e · a78bc, 확정).
 *   28~31·37~39 → 무조건
 *   공격 팀이 사람 → k ≤ 15 또는 32 ≤ k ≤ 39, 단 36 은 아님
 *   (그렇지 않고) 수비 팀이 사람 → 16 ≤ k ≤ 31 또는 k == 36
 *   둘 다 아니면 버린다.
 * `elif` 라 공격 팀이 사람이면 수비 계열은 수비 팀이 누구든 버려진다.
 * 자동진행·모드 5~7 조건은 여기서 보지 않는다 — 모드 5~7 은 기록을 붙이는 흐름이 없고, a77f2 게이트(`[ctx+0x24]`)를
 * 1 로 만드는 곳은 투수편 강판 0xc1b48 뿐이라 팀 경기에서는 늘 열려 있다 — 30G 자동진행도 기록을 막지 않는다(R15 10-3).
 */
export function passesRecordTeamGate(recordId: number, sides: { readonly offenseIsHuman: boolean; readonly defenseIsHuman: boolean }): boolean {
  if (isUngatedRecord(recordId)) return true
  if (sides.offenseIsHuman) return isOffenseRecord(recordId)
  if (sides.defenseIsHuman) return isDefenseRecord(recordId)
  return false
}
