import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { MAXIMUM_MORALE } from '@/entities/career/model/playerCareer'
import { equippedAbilityOf } from '@/entities/career/model/condition'
import { abilityLimitOf } from '@/entities/career/model/abilityLimit'
import type { TrainingOutcome } from '@/entities/career/model/training'

/** 이름표 표 0xd4ad8 — 336 히트 · 337 파워 · 338 수비 · 339 주루 · 84 사기 */
const ABILITY_ROWS: readonly (readonly [keyof BatterAbility, number])[] = [
  ['hit', 336],
  ['power', 337],
  ['defense', 338],
  ['run', 339],
]
const MORALE_LABEL_FRAME = 84
/** 타자 이름표 다섯 칸 (히트·파워·수비·주루·사기) — 상점 GP 창(pages/shop)이 쓴다 */
export const BATTER_DETAIL_LABEL_FRAMES: readonly number[] = [...ABILITY_ROWS.map(([, frame]) => frame), MORALE_LABEL_FRAME]
/**
 * 투수 이름표 — 0x87314 `0x7b984(창)`(= 창+0x20 == 3, 모드 3)이면 앞 네 칸을 img_text **340·341·342·343** 으로
 * 바꿔 쓴다 (0x8734c~0x8736e). 사기 칸 84 는 그대로다.
 */
export const PITCHER_DETAIL_LABEL_FRAMES: readonly number[] = [340, 341, 342, 343, MORALE_LABEL_FRAME]

export interface DetailRow {
  readonly labelFrame: number
  readonly current: number
  readonly maximum: number
  readonly change: number
  /**
   * 넷째 칸 (창 +0x290 + 16i) — 0 이 아니면 변화량 옆에 부호(num 105 "+" / 128 "−")와 |값| 을 그린다 (0x875bc~0x8761e).
   * 훈련은 보너스 배열 [sp+0xe8+4k] · 사기 [sp+0xf8] 을 그대로 넘긴다 (0x18d42) — 휴식·GP 는 0 으로 비운 배열이다.
   */
  readonly bonus: number
}

/** 다섯 줄(능력치 칸 0~3 · 사기)의 한 칸 값 */
export interface DetailSlots {
  readonly ability: readonly number[]
  readonly morale: number
}

const NO_SLOTS: DetailSlots = { ability: [0, 0, 0, 0], morale: 0 }

/** 모드와 상관없이 줄을 세운다 — 칸 k 는 능력치 칸 k, 넷째 줄 뒤가 사기 (0x872a0 의 다섯 줄) */
export function detailRowsFromSlots(
  labelFrames: readonly number[],
  current: DetailSlots,
  maximum: DetailSlots,
  change: DetailSlots,
  bonus: DetailSlots = NO_SLOTS,
): DetailRow[] {
  const row = (index: number, pick: (slots: DetailSlots) => number) => ({
    labelFrame: labelFrames[index],
    current: pick(current),
    maximum: pick(maximum),
    change: pick(change),
    bonus: pick(bonus),
  })
  return [...[0, 1, 2, 3].map((k) => row(k, (slots) => slots.ability[k] ?? 0)), row(4, (slots) => slots.morale)]
}

/**
 * 변화량 칸 — 원본은 전후 차이가 아니라 **굴린 값**을 넘긴다. 세 창 모두 변화량 배열을 먼저 0 으로 비운다.
 *   훈련 (0x18c58 비움 → 0x18d0e~0x18d1c): 훈련한 칸 k 에만 [sp+0x34] = 상승 굴림 bfa55 그대로,
 *     사기 칸은 −[sp+0x38] = 사기 감소 굴림 그대로 (0x18d30~0x18d38).
 *     타입 보너스·병아리·몹쓸몸·서브 아이템 보정([sp+0xe8+k]·[sp+0xf8], 0xa3bad 에 더해 넘김)과 999·0~100 자르기는 빠진다.
 *     그 보정 배열은 **넷째 칸(`bonus`)으로 따로** 넘어가 창에 나온다 (0x18d42 `[sp] = sp+0xe8`).
 *     사기 칸 보너스는 **감소량 쪽 부호 그대로**([sp+0xf8] — 0x18a16 이 [sp+0x38] 에 더한다)라 안마기·병아리는 −1, 몹쓸몸은 +2 다.
 *     필살타법(칸 4)은 0x18bd8 에서 다른 길로 가 이 창을 띄우지 않는다.
 *   휴식 (0x18ede 비움 → 0x18fb4): 능력치 칸 0, 사기 칸 = 회복 굴림 bfa55(10,16) [sp+0x10] 그대로 (100 자르기 전).
 *   GP 아이템 (0x14ea8 비움 → 0x14f5c~0x14fa4): `gpItemDetailChangesOf` (상점 화면 `pages/shop/lib/gpDetailView.ts`).
 */
export interface DetailChanges {
  readonly ability: BatterAbility
  readonly morale: number
  /** 넷째 칸 — 보정 배열 [sp+0xe8+4k] · [sp+0xf8] (없으면 0) */
  readonly bonus?: { readonly ability: BatterAbility; readonly morale: number }
}

const NO_ABILITY_CHANGE: BatterAbility = { hit: 0, power: 0, defense: 0, run: 0 }

/** 훈련 결과 창 변화량 — 필살타법은 원본에 이 창이 없어 null */
export function trainingDetailChangesOf(outcome: TrainingOutcome): DetailChanges | null {
  if (outcome.specialSwing !== null) return null
  const [ability] = Object.keys(outcome.gains) as (keyof BatterAbility)[]
  return {
    ability: { ...NO_ABILITY_CHANGE, [ability]: outcome.rolledGain },
    morale: -outcome.rolledMoraleLoss,
    // 보정 = 더해 넘긴 값 − 굴린 값 (gains 는 자르기 전 합, moraleLoss 는 [sp+0x38] + [sp+0xf8])
    bonus: {
      ability: { ...NO_ABILITY_CHANGE, [ability]: (outcome.gains[ability] ?? 0) - outcome.rolledGain },
      morale: outcome.moraleLoss - outcome.rolledMoraleLoss,
    },
  }
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
  const slotsOf = (ability: BatterAbility, morale: number): DetailSlots => ({
    ability: ABILITY_ROWS.map(([key]) => ability[key]),
    morale,
  })
  const difference: BatterAbility = {
    hit: current.hit - previous.hit,
    power: current.power - previous.power,
    defense: current.defense - previous.defense,
    run: current.run - previous.run,
  }
  return detailRowsFromSlots(
    BATTER_DETAIL_LABEL_FRAMES,
    slotsOf(current, after.morale),
    slotsOf(limits, MAXIMUM_MORALE),
    changes ? slotsOf(changes.ability, changes.morale) : slotsOf(difference, after.morale - before.morale),
    changes?.bonus ? slotsOf(changes.bonus.ability, changes.bonus.morale) : NO_SLOTS,
  )
}

/** 창에 그릴 것 — 줄과 메시지 줄 (모드와 상관없는 꼴) */
export interface DetailView {
  readonly rows: readonly DetailRow[]
  readonly messages: readonly string[]
}

export interface DetailResult {
  readonly before: PlayerCareer
  readonly after: PlayerCareer
  readonly messages: readonly string[]
  /** 변화량 칸에 넣을 굴린 값 (`trainingDetailChangesOf`·`restDetailChangesOf`). 없으면 전후 차이 */
  readonly changes?: DetailChanges | null
}
