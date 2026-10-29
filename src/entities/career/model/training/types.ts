import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { TrainingModifiers } from '@/entities/career/model/trainingText'
import type { BatterAbility } from '@/entities/career/model/training/otherSlices'
import type { RandomPort } from '@/shared/api/random/randomPort'

export interface TrainingMenu {
  readonly id: string
  readonly name: string
  /** 올리는 능력치. 비어 있으면 필살타법 칸 */
  readonly abilities: readonly (keyof BatterAbility)[]
}

export interface SpecialSwingProgress {
  /** 이번 훈련까지 누적 횟수 (StrMODE[86] "%d/%d회") */
  readonly sessions: number
  readonly required: number
  readonly isLevelUp: boolean
  /**
   * 결과 글의 기술 이름 — 0x180e6~0x1810e: n = 표 0xcc378[창 커서] (= 배운 수 + 1, 훈련할 수 있는 칸은 그 하나뿐),
   * n == 4 면 4 + 타입 → StrCOMMON[0x18 + n] (타자편 · 투수편은 [0x1e + n])
   */
  readonly name: string
}

/**
 * 결과 상태 125 의 0x17f5c 필살 · 마구 갈래 (0x18116~0x1816e, 직접 떴다): 훈련 앞 레벨 [sp+0x30] < 뒤 레벨 [sp+0x24] 이면
 * 이름 + StrMODE[87] 을 쓰고 **선수 +0x18 = 표 0xcc378[커서]** (0x1814a 0x1fc75 로 기록을 얻어 0x1816c strb) — 배운 기술을
 * 곧바로 쓰는 기술로 고른다. 아니면 StrMODE[86] "[이름] %d/%d회 훈련". 배운 수 L 의 칸 커서는 L 이라 번호는 L + 1 이다.
 */
export function learnedSpecialNumberOf(levelBefore: number): number {
  return levelBefore + 1
}

export interface TrainingOutcome {
  readonly menuId: string
  readonly gains: Partial<BatterAbility>
  readonly typeBonus: number
  readonly moraleLoss: number
  /**
   * 굴린 값 그대로 — 보너스(타입·스킬·서브 아이템)와 자르기 전. 상세 결과 창 변화량이 이 값을 쓴다
   * (0x18d14 훈련 칸 [sp+0x34] · 0x18d36 사기 칸 −[sp+0x38]). 필살타법은 상승 굴림이 없어 0.
   */
  readonly rolledGain: number
  readonly rolledMoraleLoss: number
  /** 사기 보정을 낸 것 — 결과 글의 "(±n)" 괄호와 보정 줄 (0x17f5c [sp+0xf8] · [sp+0x28]) */
  readonly modifiers: TrainingModifiers
  /** 훈련 칸 k 의 서브 아이템(+2)을 가졌는가 — 결과 창 보정 줄 (0x187f6) */
  readonly hasSubItemBonus: boolean
  readonly specialSwing: SpecialSwingProgress | null
  readonly career: PlayerCareer
}

export type TrainingBlockReason = '사기부족' | '능력치최대' | '훈련완료'

/** [minimum, maximumExclusive) */
export interface IntegerRange {
  readonly minimum: number
  readonly maximumExclusive: number
}

export const isSpecialSwingMenu = (menu: TrainingMenu) => menu.abilities.length === 0

/** [minimum, maximumExclusive) 정수 하나 — 원본 bfa55(a, b) */
export function rollInRange(random: RandomPort, range: IntegerRange): number {
  return random.rand(range.minimum, range.maximumExclusive)
}
