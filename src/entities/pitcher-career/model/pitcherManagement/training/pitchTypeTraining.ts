import { trainingMoraleAdjustmentOf } from '@/entities/pitcher-career/model/pitcherManagement/otherSlices'
import { countReleaseTrainingStreak } from '@/entities/pitcher-career/model/pitcherManagement/counts/releaseStreak'
import { countPitcherTraining } from '@/entities/pitcher-career/model/pitcherManagement/counts/trainingCounts'
import { MAGIC_TRAINING_MENU, MAGIC_TRAINING_SLOT } from '@/entities/pitcher-career/model/pitcherManagement/menus'
import { rollIn, trainingModifiersOf } from '@/entities/pitcher-career/model/pitcherManagement/training/modifiers'
import type { IntegerRange } from '@/entities/pitcher-career/model/pitcherManagement/training/modifiers'
import type { PitchTypeTrainingOutcome } from '@/entities/pitcher-career/model/pitcherManagement/training/types'
import { gainPitcherMorale, spendPitcherCycleAction } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { applyPitchTypeTraining } from '@/entities/pitcher-career/model/pitchTraining'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 구질 훈련(108 탭 2)의 사기 감소 굴림 `bfa55(6,10)` — 0x1836a */
const PITCH_TYPE_MORALE_RANGE: IntegerRange = { minimum: 6, maximumExclusive: 10 }

/**
 * **구질 훈련 한 번** — 108 탭 2 확인 [예] → 125 → 훈련 0x17f5c 칸 4 의 탭 2 갈래(0x17fd0 `[[this+0xe0]+0x188] == 2` →
 * 0x1836a, 직접 떴다):
 * ```
 * 1836a  사기 감소 = bfa55(6,10)
 * 18384  병아리(장착 0xa4bf8 0) −1 · 몹쓸몸(장착 3) +2 · 자동안마기(기록 +0x5c) −1
 * 18408  0xa3bad(S, 5, 0, 사기 감소, 행, 열)        ; `applyPitchTypeTraining` 뒤 사기 a3a44(사기 − 감소)
 * 18474  알림 글 — 단계 > 열/2 면 StrMODE[88], 아니면 [89] "해당 구질 %d/%d회 훈련" · "사기 n 하락" (`pitchTypeTrainingLinesOf`)
 * 18a5c  훈련 수 +0x4b+4 += 1 · 해제 카운터 · 몹쓸몸/유리몸 카운터
 * 18bd8  칸 4 → 알림 창 0xbbef9(코드 4) → 18d66 S+4 = 1(행동함) · 저장 → 창이 닫히면 125 틀 0x18dd8 이 105
 * ```
 */
export function runPitchTypeTraining(career: PitcherCareer, row: number, column: number, random: RandomPort): PitchTypeTrainingOutcome {
  const rolledMoraleLoss = rollIn(random, PITCH_TYPE_MORALE_RANGE)
  const modifiers = trainingModifiersOf(career)
  const moraleLoss = rolledMoraleLoss + trainingMoraleAdjustmentOf(modifiers)
  const applied = applyPitchTypeTraining(career, row, column)
  const trained = spendPitcherCycleAction(gainPitcherMorale(applied.career, -moraleLoss))
  return {
    progress: applied.progress,
    rolledMoraleLoss,
    modifiers,
    moraleLoss,
    career: countReleaseTrainingStreak(countPitcherTraining(trained, MAGIC_TRAINING_MENU.id), MAGIC_TRAINING_SLOT),
  }
}
