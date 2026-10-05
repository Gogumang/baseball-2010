import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { MAXIMUM_MORALE } from '@/entities/career/model/playerCareer'
import { equippedAbilityOf } from '@/entities/career/model/condition'
import { abilityLimitOf } from '@/entities/career/model/abilityLimit'
import type { TrainingOutcome } from '@/entities/career/model/training'

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

/**
 * 변화량 칸 — 원본은 전후 차이가 아니라 **굴린 값**을 넘긴다. 세 창 모두 변화량 배열을 먼저 0 으로 비운다.
 *   훈련 (0x18c58 비움 → 0x18d0e~0x18d1c): 훈련한 칸 k 에만 [sp+0x34] = 상승 굴림 bfa55 그대로,
 *     사기 칸은 −[sp+0x38] = 사기 감소 굴림 그대로 (0x18d30~0x18d38).
 *     타입 보너스·병아리·몹쓸몸·서브 아이템 보정([sp+0xe8+k]·[sp+0xf8], 0xa3bad 에 더해 넘김)과 999·0~100 자르기는 빠진다.
 *     필살타법(칸 4)은 0x18bd8 에서 다른 길로 가 이 창을 띄우지 않는다.
 *   휴식 (0x18ede 비움 → 0x18fb4): 능력치 칸 0, 사기 칸 = 회복 굴림 bfa55(10,16) [sp+0x10] 그대로 (100 자르기 전).
 *   GP 아이템 (0x14ea8 비움 → 0x14f5c~0x14fa4, 웹엔 이 창이 아직 없다): 아이템 0~3 은 그 칸, 4 는 네 칸 모두에
 *     "타입 한계 > 0xb6415(기록,k,0)" 일 때만 10 · 영지버섯(6)은 사기 칸 40.
 */
export interface DetailChanges {
  readonly ability: BatterAbility
  readonly morale: number
}

const NO_ABILITY_CHANGE: BatterAbility = { hit: 0, power: 0, defense: 0, run: 0 }

/** 훈련 결과 창 변화량 — 필살타법은 원본에 이 창이 없어 null */
export function trainingDetailChangesOf(outcome: TrainingOutcome): DetailChanges | null {
  if (outcome.specialSwing !== null) return null
  const [ability] = Object.keys(outcome.gains) as (keyof BatterAbility)[]
  return { ability: { ...NO_ABILITY_CHANGE, [ability]: outcome.rolledGain }, morale: -outcome.rolledMoraleLoss }
}

/** 휴식 결과 창 변화량 — 사기 회복 굴림 그대로 */
export function restDetailChangesOf(moraleGain: number): DetailChanges {
  return { ability: NO_ABILITY_CHANGE, morale: moraleGain }
}

/**
 * 현재값은 `0xb6415(기록, k, 1)` = 0xb6414 (장비·장착 스킬까지) 다 — 훈련 0x18cf6 · 휴식 0x18f7c · GP 0x14f42 모두
 * 0xb570c 를 거치지 않으니 질병·부상·사기 감소는 안 먹는다. 최대값은 0x5e864 가 채운 타입 한계(+0x118).
 * 변화량은 `changes`(굴린 값, 위 주석)를 쓴다. `changes` 가 없으면 전후 0xb6414 차이로 대신한다
 * — 원본과 다르다 (보너스·자르기가 섞인다). 결과를 만드는 쪽이 `changes` 를 넘겨야 원본과 같다.
 */
export function detailRowsOf(before: PlayerCareer, after: PlayerCareer, changes?: DetailChanges | null): DetailRow[] {
  const previous = equippedAbilityOf(before)
  const current = equippedAbilityOf(after)
  const limits = abilityLimitOf(after.battingTypeIndex)
  return [
    ...ABILITY_ROWS.map(([key, labelFrame]) => ({
      labelFrame,
      current: current[key],
      maximum: limits[key],
      change: changes ? changes.ability[key] : current[key] - previous[key],
    })),
    {
      labelFrame: MORALE_LABEL_FRAME,
      current: after.morale,
      maximum: MAXIMUM_MORALE,
      change: changes ? changes.morale : after.morale - before.morale,
    },
  ]
}

export interface DetailResult {
  readonly before: PlayerCareer
  readonly after: PlayerCareer
  readonly messages: readonly string[]
  /** 변화량 칸에 넣을 굴린 값 (`trainingDetailChangesOf`·`restDetailChangesOf`). 없으면 전후 차이 */
  readonly changes?: DetailChanges | null
}
