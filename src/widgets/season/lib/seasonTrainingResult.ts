import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { MORALE_LIMIT } from '@/entities/season-mode/model/seasonRecord'
import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import {
  HELL_TRAINING_GAIN_RANGE, HELL_TRAINING_INDEX, HELL_TRAINING_MORALE_LOSS_RANGE, MASSAGER_MORALE_RELIEF,
  TRAINING_APPLY_LIMIT, TRAINING_GAIN_RANGE, TRAINING_MORALE_LOSS_RANGE, TRAINING_SUB_ITEM_GAIN,
} from '@/widgets/season/lib/seasonTraining'

/**
 * 시즌 팀 트레이닝 굴림 0xc074 — 0xde 연출이 끝난 틀(0xc384 → 0x84e58 참)에 한 번 돈다 (직접 떴다).
 *
 * ```
 * 0xc08e  [sp+0x6c..0x7c] (상승 4칸 · 사기 감소) · [sp+0x58..0x68] (보정 4칸 · 사기 보정) 을 0 으로
 * 칸 0~3: [sp+0x6c+4칸] = bfa55(4,7) → [sp+0x7c] = bfa55(6,9)                 ; 상승 먼저, 감소 다음
 * 칸 4  : [sp+0x7c] = bfa55(10,14) → i = 0..3 차례로 [sp+0x6c+4i] = bfa55(7,11)  ; **감소 먼저**, 상승 넷
 * 0xc0ee  보정: 칸 0~3 은 그 칸만, 칸 4 는 네 칸 각각 — SR+0x58+i 가 있으면 [sp+0x58+4i] += 2 와 글 한 줄
 * 0xc1d8  SR+0x5c(자동안마기) 있으면 [sp+0x68] −= 1 과 글 한 줄
 * 0xc22a  글 버퍼 0x1552af4 를 비우고(0x200) 지은 글을 옮긴다
 * 0xc25c  적용 0xa2f24(SR, 칸, 상승+보정 4칸, [sp+0x7c] + [sp+0x68])
 * 0xc290  팀 레코드(0x1f570(저장, SR[1]))를 **적용 뒤** 다시 읽어 현재값 = +4 · +6 · +8 · +0xa · 사기 +2
 * 0xc2ce  최대 표 0xcbe58 = [999, 999, 999, 999, 100], [sp+0x7c] = −[sp+0x7c]
 * 0xc2e2  0x872a0(창, 현재, 최대, 상승(사기 칸은 −감소), 보정) — 상세 결과 창 다섯 줄
 * 0xc2fa  0x741a0(팝업, 0, 그리기 0xf63d, 키 0xf649, this) — 결과 팝업
 * ```
 * 글 한 줄 = `"!cFFFFFF[!cFFFF00" + StrITEM[0x6d + i] + "!cFFFFFF]" + " " + StrMODE[44 + i] + "+2" + "!N"`,
 * 안마기 = `… StrITEM[0x6d + 4] … " " + "사기감소-1" + "!N"` (0x845f0 = [gfx+0x1ac](StrITEM)[0x6d + i]).
 */
export interface SeasonTrainingRoll {
  /** [sp+0x6c+4i] — 굴린 상승 (안 고른 칸은 0) */
  readonly gains: readonly number[]
  /** [sp+0x58+4i] — 서브 아이템 보정 +2 */
  readonly bonuses: readonly number[]
  /** [sp+0x7c] — 굴린 사기 감소 */
  readonly moraleLoss: number
  /** [sp+0x68] — 자동안마기면 −1 */
  readonly moraleBonus: number
}

type TrainingItems = Pick<SeasonRecord, 'trainingSubItems' | 'massager'>

/** 굴림 0xc074 — 난수 차례가 원본 그대로다 (칸 0~3 은 상승 → 감소, 지옥훈련은 감소 → 상승 넷) */
export function rollSeasonTraining(random: RandomPort, slot: number, items: TrainingItems): SeasonTrainingRoll {
  const gains = [0, 0, 0, 0]
  let moraleLoss: number
  if (slot === HELL_TRAINING_INDEX) {
    moraleLoss = randomIntegerBelow(random, HELL_TRAINING_MORALE_LOSS_RANGE[0], HELL_TRAINING_MORALE_LOSS_RANGE[1])
    for (let index = 0; index < gains.length; index += 1) {
      gains[index] = randomIntegerBelow(random, HELL_TRAINING_GAIN_RANGE[0], HELL_TRAINING_GAIN_RANGE[1])
    }
  } else {
    gains[slot] = randomIntegerBelow(random, TRAINING_GAIN_RANGE[0], TRAINING_GAIN_RANGE[1])
    moraleLoss = randomIntegerBelow(random, TRAINING_MORALE_LOSS_RANGE[0], TRAINING_MORALE_LOSS_RANGE[1])
  }
  const bonuses = gains.map((_gain, index) =>
    trainedSlotsOf(slot).includes(index) && items.trainingSubItems[index] === true ? TRAINING_SUB_ITEM_GAIN : 0)
  return { gains, bonuses, moraleLoss, moraleBonus: items.massager ? -MASSAGER_MORALE_RELIEF : 0 }
}

const trainedSlotsOf = (slot: number): readonly number[] => (slot === HELL_TRAINING_INDEX ? [0, 1, 2, 3] : [slot])

/** 적용 0xa2f24 — 능력치 += 상승 + 보정(999 로 자름), 사기 −= 감소 + 보정(0..100) */
export function applySeasonTraining(
  abilities: readonly number[],
  teamMorale: number,
  roll: SeasonTrainingRoll,
): { readonly abilities: number[]; readonly teamMorale: number } {
  return {
    abilities: abilities.map((value, index) =>
      Math.min(TRAINING_APPLY_LIMIT, value + (roll.gains[index] ?? 0) + (roll.bonuses[index] ?? 0))),
    teamMorale: Math.max(0, Math.min(MORALE_LIMIT, teamMorale - (roll.moraleLoss + roll.moraleBonus))),
  }
}

/** StrITEM 서브 아이템 이름 첫 칸 (0x845f0 `adds r1, #0x6d`) — 109 표적판 · 110 피칭머신 · 111 MG스퀘어 · 112 하드타이어 · 113 자동안마기 */
const SUB_ITEM_NAME_BASE = 0x6d
/** StrMODE[44 + i] 투구 · 타격 · 집중 · 근성 */
const ABILITY_NAME_BASE = 44
/** 0x845f0 의 칸 4 — 자동안마기 */
const MASSAGER_NAME_INDEX = 4

const subItemLineOf = (nameIndex: number, effect: string) =>
  `!cFFFFFF[!cFFFF00${ORIGINAL_ITEMS[SUB_ITEM_NAME_BASE + nameIndex] ?? ''}!cFFFFFF] ${effect}`

/**
 * 결과 창 글 줄 — 글 버퍼 0x1552af4 를 `!N` 으로 끊은 줄들. 보정이 없으면 빈 글이라 창이 글 상자를 안 그린다.
 * **끝의 `!N` 뒤 빈 줄은 줄 수에 안 든다** (직접 떴다): 0x872d4 가 그릴 때마다 0x6ef4d(…, 첫 줄 0, 줄 수 −1, 출력)로 재어
 * [창+0x2d4] 에 넣는다. 0x6ef4d 는 `!N`(0x6f02a 걸음 2)이나 글 끝(0x6f0bc `i ≥ 길이 − 걸음`)에서 줄 수 [sp+0x48] 를
 * 하나 올리는데, 끝의 `!N` 은 두 조건이 한 번에 서서 한 번만 센다 → 줄 수 = 줄 개수.
 */
export function seasonTrainingMessagesOf(slot: number, items: TrainingItems): string[] {
  const lines = trainedSlotsOf(slot)
    .filter((index) => items.trainingSubItems[index] === true)
    .map((index) => subItemLineOf(index, `${ORIGINAL_MODE_TEXT[ABILITY_NAME_BASE + index] ?? ''}+${TRAINING_SUB_ITEM_GAIN}`))
  if (items.massager) lines.push(subItemLineOf(MASSAGER_NAME_INDEX, '사기감소-1'))
  return lines
}

/**
 * 결과 창 줄의 이름표 — 0x872d4 가 `0x7b998(창)`(창+0x20 == 2, 시즌)이고 [gfx+0x174] ≠ 0xda 이면
 * 앞 네 칸을 img_text **46 · 347 · 204 · 205** 로 바꾼다(0x87360~0x8736c). 사기 칸 84 는 표 0xd4ad8 그대로.
 */
export const SEASON_TEAM_DETAIL_LABEL_FRAMES: readonly number[] = [46, 347, 204, 205, 84]
/** 최대 표 0xcbe58 */
export const SEASON_TRAINING_MAXIMUMS = { ability: [999, 999, 999, 999], morale: 100 } as const

/** 결과 창 다섯 줄 (0x872a0) 의 네 칸 — 현재는 **적용 뒤** 값, 사기 변화는 −감소(보정 따로) */
export interface SeasonTrainingResult {
  readonly current: { readonly ability: readonly number[]; readonly morale: number }
  readonly change: { readonly ability: readonly number[]; readonly morale: number }
  readonly bonus: { readonly ability: readonly number[]; readonly morale: number }
  readonly messages: readonly string[]
}

export function seasonTrainingResultOf(
  slot: number,
  items: TrainingItems,
  roll: SeasonTrainingRoll,
  after: { readonly abilities: readonly number[]; readonly teamMorale: number },
): SeasonTrainingResult {
  return {
    current: { ability: after.abilities.slice(0, 4), morale: after.teamMorale },
    change: { ability: roll.gains, morale: -roll.moraleLoss },
    bonus: { ability: roll.bonuses, morale: roll.moraleBonus },
    messages: seasonTrainingMessagesOf(slot, items),
  }
}

/**
 * 결과 팝업 키 0xf2c8 (직접 떴다) — 확인(−5 · '5') · 취소(−16) 면 팝업을 닫고(0x742a9) 상태 0xc9.
 * 위(−1 · '2') 0x7d0d8: 첫 줄 −1, 0 보다 작아지면 max(0, 줄 수 − 4) 로. 아래(−2 · '8') 0x7d0fc: 첫 줄 +1, 줄 수 − 4 를
 * 넘으면 0 으로 — 양쪽 다 끝에서 반대쪽 끝으로 돈다(원본 그대로).
 */
export function scrollSeasonTrainingMessages(first: number, lineCount: number, direction: -1 | 1): number {
  if (direction < 0) {
    const next = first - 1
    return next < 0 ? Math.max(0, lineCount - 4) : next
  }
  const next = first + 1
  return next > lineCount - 4 ? 0 : next
}
