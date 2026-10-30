import rawConfig from '@/shared/config/unlocks/unlocks.json'
import { parseUnlockConfig } from '@/shared/config/unlocks/unlockConfig'
import type { UnlockConfig } from '@/shared/config/unlocks/unlockConfig'

export { UNLOCK_KINDS, parseUnlockConfig } from '@/shared/config/unlocks/unlockConfig'
export type { UnlockConfig, UnlockKind } from '@/shared/config/unlocks/unlockConfig'

/**
 * **해금 관리 표** — 화면에 보이지만 잠겨 있는 것(마선수·히든 팀·히든 아이템·마구·미션 칸·명전 칸·기록연감 숨은 쪽)을
 * `unlocks.json` 한 파일로 켜고 끈다 (사용자 요청 2026-10-25: "보여지는 거는 다 풀어줘 · 해금 방법은 소스가 읽는 JSON 으로").
 *
 * - `unlockAll: true`(기본) 면 표의 모든 항목이 풀린다.
 * - 항목 `unlocked` 로 하나씩 덮어쓴다 — `true` 늘 풀림 · `false` 원본 조건대로 · `null` `unlockAll` 을 따른다.
 *   `false` 는 "강제로 잠금" 이 아니다: 원본에서 이미 연 것을 닫으면 원본 동작이 바뀌므로 원본 조건으로만 판정한다.
 * - **저장에는 아무것도 쓰지 않는다.** 판정할 때만 푼다 — JSON 을 되돌리면 원래대로 돌아간다.
 *   그래서 "새로 열렸나" 를 가리는 기록 쪽 코드(알림 · 전역 해금표 쓰기)는 이 함수를 거치지 않고 저장 값을 그대로 본다.
 *
 * 각 잠금 판정 코드는 원본 조건 판정을 지우지 않고 `isUnlocked(id, () => 원본판정)` 으로 감싼다.
 */
/** `unlocks.json` 그대로 */
export const UNLOCK_CONFIG: UnlockConfig = parseUnlockConfig(rawConfig)

/** 원본 그대로 — 아무것도 강제로 풀지 않는다 (시험이 잠금을 전제로 돌 때 쓴다) */
export const ORIGINAL_UNLOCK_CONFIG: UnlockConfig = { unlockAll: false, entries: [] }

let activeConfig: UnlockConfig = UNLOCK_CONFIG
let forcedById: ReadonlyMap<string, boolean | null> = forcedMapOf(UNLOCK_CONFIG)

function forcedMapOf(config: UnlockConfig): ReadonlyMap<string, boolean | null> {
  return new Map(config.entries.map((entry) => [entry.id, entry.unlocked]))
}

/** 시험용 — 쓸 해금 표를 바꾼다. null 이면 `unlocks.json` 으로 돌아간다 */
export function setUnlockConfigForTests(config: UnlockConfig | null): void {
  activeConfig = config ?? UNLOCK_CONFIG
  forcedById = forcedMapOf(activeConfig)
}

/** 지금 쓰는 해금 표 */
export function activeUnlockConfig(): UnlockConfig {
  return activeConfig
}

/**
 * **해금 판정 공용 함수** — 표가 풀라고 하면 참, 아니면 원본 판정(`originalCheck`)을 그대로 돌린다.
 * 원본 판정은 풀리는 경우 부르지 않는다(판정에 굴림이 없어 난수 차례는 바뀌지 않는다).
 */
export function isUnlocked(id: string, originalCheck: () => boolean): boolean {
  const forced = forcedById.get(id)
  if (forced === true) return true
  if (forced === false) return originalCheck()
  return activeConfig.unlockAll || originalCheck()
}

/**
 * 전역 해금 k(0~50 — 원본 0x620b8 · 0x61f5c · 0x62368 이 쓰는 번호)의 표 id.
 * k 0~7 마선수 · 8~12 히든 팀 · 13~18 구장 · 19~34 투수 장비 · 35~50 타자 장비 (`entities/collection/model/hiddenOpenNotice`).
 */
const ACE_UNLOCK_IDS: readonly string[] = [
  'ace-leony',
  'ace-bbmachine',
  'ace-ballantine',
  'ace-dragona',
  'ace-kao',
  'ace-roze',
  'ace-death',
  'ace-tiger',
]
const HIDDEN_TEAM_UNLOCK_IDS: readonly string[] = [
  'hidden-team-korea',
  'hidden-team-japan',
  'hidden-team-cuba',
  'hidden-team-usa',
  'hidden-team-outsiders',
]
export const HIDDEN_UNLOCK_COUNT = 51
const FIRST_HIDDEN_ITEM = ACE_UNLOCK_IDS.length + HIDDEN_TEAM_UNLOCK_IDS.length

export function hiddenUnlockIdOf(k: number): string | null {
  if (!Number.isInteger(k) || k < 0 || k >= HIDDEN_UNLOCK_COUNT) return null
  if (k < ACE_UNLOCK_IDS.length) return ACE_UNLOCK_IDS[k]
  if (k < FIRST_HIDDEN_ITEM) return HIDDEN_TEAM_UNLOCK_IDS[k - ACE_UNLOCK_IDS.length]
  return `hidden-item-${k}`
}

/** 전역 해금 k 가 풀렸나 — 표에 없는 k 면 원본 판정 그대로 */
export function isHiddenUnlocked(k: number, originalCheck: () => boolean): boolean {
  const id = hiddenUnlockIdOf(k)
  return id === null ? originalCheck() : isUnlocked(id, originalCheck)
}

/** 마선수 격자 칸(0~9)이 여는 전역 해금 k — 칸 0 싸이커 · 5 메디카는 기본 개방이라 없다 (0x620b8: 칸 1~4 = k 0~3 · 6~9 = k 4~7) */
export function aceCellUnlockIdOf(cell: number): string | null {
  if (cell >= 1 && cell <= 4) return hiddenUnlockIdOf(cell - 1)
  if (cell >= 6 && cell <= 9) return hiddenUnlockIdOf(cell - 2)
  return null
}

/** 히든 팀 번호(10~14 — 웹 전역 해금표의 팀 번호)의 표 id */
export const HIDDEN_TEAM_FIRST_NUMBER = 10
export function hiddenTeamUnlockIdOf(teamId: number): string | null {
  return HIDDEN_TEAM_UNLOCK_IDS[teamId - HIDDEN_TEAM_FIRST_NUMBER] ?? null
}

/** 마구 계열 — 구질 훈련 표 행 0~3 (열 4 히든) */
const HIDDEN_PITCH_UNLOCK_IDS: readonly string[] = [
  'hidden-pitch-gyro',
  'hidden-pitch-power-sinker',
  'hidden-pitch-power-slider',
  'hidden-pitch-knuckle',
]
export function hiddenPitchUnlockIdOf(row: number): string | null {
  return HIDDEN_PITCH_UNLOCK_IDS[row] ?? null
}

/** 미션 고르기 칸(0~13)의 표 id — 칸 0 은 처음부터 열려 있어 없다. 이름은 미션 번호(칸 + 1) */
export const MISSION_UNLOCK_CELLS = 14
export function missionUnlockIdOf(side: '타자' | '투수', cell: number): string | null {
  if (!Number.isInteger(cell) || cell < 1 || cell >= MISSION_UNLOCK_CELLS) return null
  return `mission-${side === '타자' ? 'batter' : 'pitcher'}-${cell + 1}`
}

/** 명예의 전당 칸(편 안 번호, 0 부터)의 표 id — 기본 개방(투수 0~1 · 타자 0~3)은 없다. 이름은 칸 번호(번호 + 1) */
export const HALL_OF_FAME_DEFAULT_OPEN = { 투수: 2, 타자: 4 } as const
export const HALL_OF_FAME_SLOT_MAX = { 투수: 4, 타자: 8 } as const
export function hallOfFameSlotUnlockIdOf(side: '타자' | '투수', slot: number): string | null {
  if (!Number.isInteger(slot) || slot < HALL_OF_FAME_DEFAULT_OPEN[side] || slot >= HALL_OF_FAME_SLOT_MAX[side]) return null
  return `hall-of-fame-${side === '타자' ? 'batter' : 'pitcher'}-slot-${slot + 1}`
}

/** 기록연감 통계 탭의 숨은 쪽 (비밀 번호 0x2b7a0) */
export const ANNALS_SECRET_PAGES_UNLOCK_ID = 'annals-secret-pages'

/** 코드가 쓰는 표 id 전부 — `unlocks.json` 의 항목과 1:1 이어야 한다 (시험이 본다) */
export function codeUnlockIds(): readonly string[] {
  const ids: string[] = []
  for (let k = 0; k < HIDDEN_UNLOCK_COUNT; k += 1) ids.push(hiddenUnlockIdOf(k) as string)
  ids.push(...HIDDEN_PITCH_UNLOCK_IDS)
  for (const side of ['타자', '투수'] as const) {
    for (let cell = 1; cell < MISSION_UNLOCK_CELLS; cell += 1) ids.push(missionUnlockIdOf(side, cell) as string)
  }
  for (const side of ['투수', '타자'] as const) {
    for (let slot = HALL_OF_FAME_DEFAULT_OPEN[side]; slot < HALL_OF_FAME_SLOT_MAX[side]; slot += 1) {
      ids.push(hallOfFameSlotUnlockIdOf(side, slot) as string)
    }
  }
  ids.push(ANNALS_SECRET_PAGES_UNLOCK_ID)
  return ids
}
