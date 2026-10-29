import {
  abilityTrainingBonusLinesOf,
  pitchTrainingHeadTextOf,
  specialTrainingHeadTextOf,
  specialTrainingTailLinesOf,
  trainingMoraleLossTextOf,
} from '@/entities/pitcher-career/model/pitcherManagement/otherSlices'
import { PITCHER_TYPE_NAMES } from '@/entities/pitcher-career/model/pitcherManagement/menus'
import type {
  PitchTypeTrainingOutcome,
  PitcherMagicProgress,
  PitcherTrainingOutcome,
} from '@/entities/pitcher-career/model/pitcherManagement/training/types'
import { PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'

/** 투수 능력치 이름 StrMODE[0x28 + k] (0x188a4) */
const PITCHER_ABILITY_NAME_BASE = 0x28
/** 능력치를 올리지 않은 결과(마구) — 칸이 없다 */
const NO_SLOT = -1

/**
 * 구질 훈련 알림 글 (0x18474~0x186c2) — 첫 줄 StrMODE[88] "구질 훈련 완료!" / [89] "해당 구질 %d/%d회 훈련",
 * 다음 줄 사기(보정이 있으면 "(±n)"), 그 뒤 "!N" 과 병아리 · 몹쓸몸 · 자동안마기 효과 줄(0x185a8~0x186c2). 모두 원문 표에서 읽는다.
 */
export function pitchTypeTrainingLinesOf(outcome: PitchTypeTrainingOutcome): string[] {
  const { isLearned, sessions, required } = outcome.progress
  return [
    pitchTrainingHeadTextOf(isLearned, sessions, required),
    trainingMoraleLossTextOf(outcome.moraleLoss, outcome.modifiers),
    ...specialTrainingTailLinesOf(outcome.modifiers),
  ]
}

/**
 * 마구 훈련 알림 글 — 0x17f5c 칸 4 갈래(모드 3)는 타자편 필살타법과 같은 줄이다(0x18116~0x18368): 마구 이름 StrCOMMON[0x1e + n] 으로
 * 훈련 완료면 이름 + StrMODE[87] " 훈련 완료!!N[선수정보]에서 사용!N여부 변경 가능", 아니면 [86] "[이름] %d/%d회 훈련",
 * 다음 줄 사기 StrMODE[24] + 감소 + "(±보정)" + [84], 그 뒤 효과 줄 — 모두 원문 표에서 읽는다.
 */
export function magicTrainingLinesOf(magic: PitcherMagicProgress, outcome: Pick<PitcherTrainingOutcome, 'moraleLoss' | 'modifiers'>): string[] {
  return [
    specialTrainingHeadTextOf(magic.name, magic.isLevelUp, magic.sessions, magic.required),
    trainingMoraleLossTextOf(outcome.moraleLoss, outcome.modifiers),
    ...specialTrainingTailLinesOf(outcome.modifiers),
  ]
}

/**
 * 투수편 능력치 훈련(칸 0~3) 결과 창 글 — 타자편과 같은 0x17f5c 186c4~18a58: 보정 줄만 남는다(`abilityTrainingBonusLinesOf`).
 * 타입 이름은 0x1400080[2 + 타입](0x187be), 서브 아이템 줄의 능력치 이름은 StrMODE[0x28 + k].
 * 상승 수치 줄은 원본 글에 없다(결과 창의 능력치 행이 보인다).
 */
export function pitcherAbilityTrainingLinesOf(outcome: PitcherTrainingOutcome, typeIndex: number): string[] {
  const [ability] = Object.keys(outcome.gains) as (keyof PitcherAbility)[]
  const slot = ability === undefined ? NO_SLOT : PITCHER_ABILITY_ORDER.indexOf(ability)
  return abilityTrainingBonusLinesOf({
    typeName: outcome.typeBonus > 0 ? (PITCHER_TYPE_NAMES[typeIndex] ?? '') : null,
    subItemSlot: outcome.hasSubItemBonus && slot >= 0 ? slot : null,
    abilityName: ORIGINAL_MODE_TEXT[PITCHER_ABILITY_NAME_BASE + slot] ?? '',
    modifiers: outcome.modifiers,
  })
}
