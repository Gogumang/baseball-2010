import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { MAXIMUM_MORALE } from '@/entities/career/model/playerCareer'
import { equippedAbilityOf } from '@/entities/career/model/condition'
import { abilityLimitOf } from '@/entities/career/model/abilityLimit'
import type { TrainingOutcome } from '@/entities/career/model/training'

/**
 * 상세정보 결과 창 (0x8a0a4 → 0x872d4, layout-re 3차 — 좌표 바이트 확인).
 * 훈련·휴식·GP 아이템 뒤에 뜬다. 값은 0x872a0(현재, 최대, 변화, 보너스) 다섯 줄 × 네 칸으로 넘긴다
 * (창 +0x284 + 16i 에 차례로 — 0x872a0 디스어셈 확정). 두 모드 공용 창이다.
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
/**
 * 0x872d4(창, dy) 의 둘째 인자 dy 로 표 · 글 상자를 내린다 — 나리 상세 창 0x8a0a4 는 −4(`DETAIL_Y_OFFSET`),
 * 시즌 훈련 결과 창 0xf25c 는 0 이다.
 */
export const detailMessageBoxOf = (yOffset: number = DETAIL_Y_OFFSET) => ({ ...DETAIL_MESSAGE_BOX, y: 180 + yOffset })
export const DETAIL_MESSAGE_LINE_HEIGHT = 16

/**
 * 글 상자 오른쪽 스크롤 막대 (0x8a182~0x8a2a4, 직접 떴다). 상자 R = 프레임 90 박스 5 의 y −4 (36, 176, 170, 70).
 * ```
 * 막대 바탕   (R.x + R.w − 7, R.y, 7, R.h)  #102152  (0x1400748(0x10, 0x21, 0x52) · 0xb9f75)
 * 줄 수 n = 창+0x37c,  첫 줄 s = 창+0x380
 * n ≤ 3:  흰 (막대x+1, R.y, 5, R.h) · 안 #1D44A8 (막대x+2, R.y+1, 3, R.h−2)        ; 막대 가득
 * n > 3:  길이 L = (4·R.h + n − 1) / n (올림) · 자리 p = s·R.h / n (버림)
 *         흰 (막대x+1, R.y+p, 5, L−1) · 안 #1D44A8 (막대x+2, R.y+p+1, 3, L−3)       ; 0x6a9f1 채우기
 * ```
 * 훈련·휴식·GP 결과 창도 같은 그리기라 늘 그린다.
 */
export const DETAIL_SCROLL_BAR_WIDTH = 7
export const DETAIL_SCROLL_BAR_COLORS = { track: '#102152', thumb: '#FFFFFF', thumbInner: '#1D44A8' } as const
/** 막대가 가득 차는 줄 수 상한 (0x8a1c4 `cmp r7, #3 ; bgt`) */
const DETAIL_SCROLL_FULL_LINES = 3
/** 길이 식의 4 — 보이는 줄 수 (0x8a22a `lsls r0, r6, #2`) */
const DETAIL_SCROLL_VISIBLE_LINES = 4

export interface ScrollBarRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface DetailScrollBar {
  readonly track: ScrollBarRect
  readonly thumb: ScrollBarRect
  readonly thumbInner: ScrollBarRect
}

/** 스크롤 막대 세 사각형 — 줄 수 `lineCount`(창+0x37c) · 첫 줄 `scrollOffset`(창+0x380) */
export function detailScrollBarOf(lineCount: number, scrollOffset: number, yOffset: number = DETAIL_Y_OFFSET): DetailScrollBar {
  const box = detailMessageBoxOf(yOffset)
  const x = box.x + box.width - DETAIL_SCROLL_BAR_WIDTH
  const track = { x, y: box.y, width: DETAIL_SCROLL_BAR_WIDTH, height: box.height }
  if (lineCount <= DETAIL_SCROLL_FULL_LINES) {
    return {
      track,
      thumb: { x: x + 1, y: box.y, width: DETAIL_SCROLL_BAR_WIDTH - 2, height: box.height },
      thumbInner: { x: x + 2, y: box.y + 1, width: DETAIL_SCROLL_BAR_WIDTH - 4, height: box.height - 2 },
    }
  }
  const length = Math.trunc((DETAIL_SCROLL_VISIBLE_LINES * box.height + lineCount - 1) / lineCount)
  const position = Math.trunc((scrollOffset * box.height) / lineCount)
  return {
    track,
    thumb: { x: x + 1, y: box.y + position, width: DETAIL_SCROLL_BAR_WIDTH - 2, height: length - 1 },
    thumbInner: { x: x + 2, y: box.y + position + 1, width: DETAIL_SCROLL_BAR_WIDTH - 4, height: length - 3 },
  }
}
/** ▲ mode_ui 61 · ▼ 62 */
export const CHANGE_ARROW_FRAMES = { up: 61, down: 62 }

/** i 번째 줄 위 — 0x872d4 의 dy 를 받는다 (나리 −4 · 시즌 훈련 결과 0) */
export const detailRowTopOf = (index: number, yOffset: number) => 76 + 17 * (index + 1) + yOffset
export const DETAIL_ROW_TOP = (index: number) => detailRowTopOf(index, DETAIL_Y_OFFSET)

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
  return [
    ...[0, 1, 2, 3].map((k) => row(k, (slots) => slots.ability[k] ?? 0)),
    row(4, (slots) => slots.morale),
  ]
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

/**
 * GP 아이템 결과 창 변화량 — 구매 확정 0x14a74 (두 모드 공용, 디스어셈 확정):
 *   0x14f22 `0x5e865` 로 한계(창+0x118)를 채운 뒤 **아이템 0~4 · 6 일 때만** 창을 띄운다(0x14f28·0x15030).
 *   변화량은 0 으로 비운 배열에 (효과 0xa4488 을 부르기 **전에**) 채운다 —
 *     0~3: 그 칸 k 에 `한계 > 0xb6415(기록, k, 0)` 이면 10 · 4(도시락): 네 칸 각각 같은 조건이면 10 ·
 *     6(영지버섯): 사기 칸 40 (0x14f5c~0x14fa4). 보너스 칸은 0.
 *   현재값: 능력치 네 칸은 효과 **뒤에** 다시 읽고(0x1504a 0xb6415(기록,k,1)), **사기 칸은 효과 전 값**이다
 *   (0x14f92 에서 한 번 읽고 다시 안 읽는다 — 영지버섯이면 오르기 전 사기가 보인다. 원본 그대로).
 *   최대값은 한계 · 사기 100. 창을 닫으면 콜백 0x1d649 (닫기 키에 0x742a9 만 — 굴림 없음).
 * `baseBefore` 는 효과 전 `0xb6415(기록,k,0)` (장비·스킬 뺀 값), `limits` 는 그 모드의 한계 네 칸이다.
 * 상점 화면이 `pages/shop/lib/gpDetailView.ts` 로 줄을 세워 띄운다.
 */
const GP_ABILITY_CHANGE = 10
const GP_MORALE_CHANGE = 40

export function gpItemDetailChangesOf(
  itemIndex: number,
  baseBefore: readonly number[],
  limits: readonly number[],
): DetailSlots | null {
  if (itemIndex > 4 && itemIndex !== 6) return null
  const raises = (k: number) => (limits[k] ?? 0) > (baseBefore[k] ?? 0)
  return {
    ability: [0, 1, 2, 3].map((k) => ((itemIndex === k || itemIndex === 4) && raises(k) ? GP_ABILITY_CHANGE : 0)),
    morale: itemIndex === 6 ? GP_MORALE_CHANGE : 0,
  }
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
