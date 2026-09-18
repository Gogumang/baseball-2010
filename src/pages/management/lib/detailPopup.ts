import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { MAXIMUM_MORALE } from '@/entities/career/model/playerCareer'
import { effectiveAbilityOf } from '@/entities/career/model/condition'
import { abilityLimitOf } from '@/entities/career/model/abilityLimit'

/**
 * 상세정보 결과 창 (0x8a0a4 → 0x872d4, layout-re 3차 — 좌표 바이트 확인).
 * 훈련·휴식·GP 아이템 뒤에 뜬다. 값은 0x872a0(현재, 최대, 변화) 로 넘긴다.
 */
export const DETAIL_WINDOW = { x: 24, y: 45, width: 192, height: 215 }
export const DETAIL_TITLE_FRAME = 372
export const DETAIL_HEADER = { frame: 373, box: { x: 81, y: 72, width: 71, height: 15 } }
export const DETAIL_SLASH_FRAME = 374
export const DETAIL_TABLE_FRAME = 90
/** 표 전체를 −4 만큼 올려 그린다 */
export const DETAIL_Y_OFFSET = -4
export const DETAIL_LABEL_BOX = { x: 42, width: 35, height: 15 }
export const DETAIL_VALUE_BOX = { x: 81, width: 71 }
export const DETAIL_CURRENT_DX = -15
export const DETAIL_MAXIMUM_DX = 18
export const DETAIL_CHANGE_X = 160
export const DETAIL_MESSAGE_BOX = { x: 36, y: 180 + DETAIL_Y_OFFSET, width: 170, height: 70 }
export const DETAIL_MESSAGE_LINE_HEIGHT = 16
/** ▲ mode_ui 61 · ▼ 62 */
export const CHANGE_ARROW_FRAMES = { up: 61, down: 62 }

export const DETAIL_ROW_TOP = (index: number) => 76 + 17 * (index + 1) + DETAIL_Y_OFFSET

/** 이름표 표 0xd4ad8 — 336 히트 · 337 파워 · 338 수비 · 339 주루 · 84 사기 */
const ABILITY_ROWS: readonly (readonly [keyof BatterAbility, number])[] = [
  ['hit', 336],
  ['power', 337],
  ['defense', 338],
  ['run', 339],
]
const MORALE_LABEL_FRAME = 84

export interface DetailRow {
  readonly labelFrame: number
  readonly current: number
  readonly maximum: number
  readonly change: number
}

export function detailRowsOf(before: PlayerCareer, after: PlayerCareer): DetailRow[] {
  const previous = effectiveAbilityOf(before)
  const current = effectiveAbilityOf(after)
  const limits = abilityLimitOf(after.battingTypeIndex)
  return [
    ...ABILITY_ROWS.map(([key, labelFrame]) => ({
      labelFrame,
      current: current[key],
      maximum: limits[key],
      change: current[key] - previous[key],
    })),
    { labelFrame: MORALE_LABEL_FRAME, current: after.morale, maximum: MAXIMUM_MORALE, change: after.morale - before.morale },
  ]
}

export interface DetailResult {
  readonly before: PlayerCareer
  readonly after: PlayerCareer
  readonly messages: readonly string[]
}
