import type { TrainingModifiers } from '@/entities/pitcher-career/model/pitcherManagement/otherSlices'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitchTrainingProgress } from '@/entities/pitcher-career/model/pitchTraining'

export interface PitcherMagicProgress {
  /** 이번 훈련까지 누적 횟수 (StrMODE[86] "%d/%d회") */
  readonly sessions: number
  readonly required: number
  readonly isLevelUp: boolean
  /** 결과 글의 마구 이름 — StrCOMMON[0x1e + n], n = 배운 수 + 1 (4 면 4 + 타입) (0x180e6~0x1810e) */
  readonly name: string
}

export interface PitcherTrainingOutcome {
  readonly menuId: string
  readonly gains: Partial<PitcherAbility>
  /** 타입 보너스 (0 또는 1) — 글 "[타입] 타입 보너스 +1" 을 붙일지 */
  readonly typeBonus: number
  readonly moraleLoss: number
  /**
   * 굴린 값 그대로 — 보너스(타입·스킬)와 자르기 전. 타자편 `TrainingOutcome.rolledGain` 과 같은 칸이다
   * (0x18d14 훈련 칸 [sp+0x34] · 0x18d36 사기 칸 −[sp+0x38], 결과 창 0x872a1 은 두 모드 공용).
   * 마구는 상승 굴림이 없어 0. 창 줄은 `pages/pitcher-league/lib/pitcherDetailPopup.ts` 가 세운다.
   */
  readonly rolledGain: number
  readonly rolledMoraleLoss: number
  /** 사기 보정을 낸 것 — 결과 글의 "(±n)" 괄호와 보정 줄 (0x17f5c [sp+0xf8] · [sp+0x28]) */
  readonly modifiers: TrainingModifiers
  /** 훈련 칸 k 의 서브 아이템(+2)을 가졌는가 (0x187f6) */
  readonly hasSubItemBonus: boolean
  readonly magic: PitcherMagicProgress | null
  readonly career: PitcherCareer
}

export interface PitchTypeTrainingOutcome {
  readonly progress: PitchTrainingProgress
  readonly rolledMoraleLoss: number
  /** 사기 보정 — 0x18384~0x183d0 (괄호 "(±n)" 와 효과 줄) */
  readonly modifiers: TrainingModifiers
  readonly moraleLoss: number
  readonly career: PitcherCareer
}
