import { trainingMoraleAdjustmentOf } from '@/entities/pitcher-career/model/pitcherManagement/otherSlices'
import { countReleaseTrainingStreak } from '@/entities/pitcher-career/model/pitcherManagement/counts/releaseStreak'
import { countPitcherTraining } from '@/entities/pitcher-career/model/pitcherManagement/counts/trainingCounts'
import { MAGIC_REQUIRED_SESSIONS, magicTrainingCellCostOf } from '@/entities/pitcher-career/model/pitcherManagement/magic/magicCells'
import { MAGIC_TRAINING_SLOT } from '@/entities/pitcher-career/model/pitcherManagement/menus'
import type { PitcherTrainingMenu } from '@/entities/pitcher-career/model/pitcherManagement/menus'
import { rollIn, trainingModifiersOf } from '@/entities/pitcher-career/model/pitcherManagement/training/modifiers'
import type { IntegerRange } from '@/entities/pitcher-career/model/pitcherManagement/training/modifiers'
import type { PitcherMagicProgress, PitcherTrainingOutcome } from '@/entities/pitcher-career/model/pitcherManagement/training/types'
import { gainPitcherMorale, spendPitcherCycleAction } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { BALANCE } from '@/shared/config/original/balance'
import { PITCHER_BURSTS } from '@/shared/config/original/bursts'

const MAGIC_MORALE_RANGE: IntegerRange = BALANCE.specialSwing.moraleLossRange
/** 마구 번호 4 는 타입마다 다른 이름 — StrCOMMON[0x1e + 4 + 타입] */
const TYPED_MAGIC_NUMBER = 4

/** 결과 글의 마구 이름 — StrCOMMON[0x1e + n], n = 배운 수 + 1 (4 면 4 + 타입) (0x180e6~0x1810e) */
function magicNameOf(number: number, typeIndex: number): string {
  const typeOffset = number === TYPED_MAGIC_NUMBER ? typeIndex : 0
  return PITCHER_BURSTS[number - 1 + typeOffset] ?? ''
}

/** 마구 진도 — 이번 훈련까지 누적 횟수가 필요 횟수에 닿으면 레벨이 오른다 */
function magicProgressOf(career: PitcherCareer): PitcherMagicProgress {
  const required = MAGIC_REQUIRED_SESSIONS[career.magicLevel]
  const sessions = career.magicSessions + 1
  return { sessions, required, isLevelUp: sessions >= required, name: magicNameOf(career.magicLevel + 1, career.typeIndex) }
}

/** 훈련을 먹인 기록 — G 를 내고(0 바닥, 0xa3c84) 레벨이 오르면 진도를 0 으로 · 선수 +0x18 을 새 번호로 */
function applyMagicTraining(career: PitcherCareer, spent: PitcherCareer, progress: PitcherMagicProgress): PitcherCareer {
  const level = career.magicLevel
  return {
    ...spent,
    gamePoint: Math.max(0, career.gamePoint - magicTrainingCellCostOf(level)),
    magicLevel: progress.isLevelUp ? level + 1 : level,
    magicSessions: progress.isLevelUp ? 0 : progress.sessions,
    // 0x1816c — 훈련 완료면 선수 +0x18 = 표 0xcc378[커서] = 배운 수 + 1 (타자편 `learnedSpecialNumberOf` 와 같은 줄)
    ...(progress.isLevelUp ? { selectedMagicNumber: level + 1 } : {}),
  }
}

/** 마구 훈련 한 번 (칸 4 의 탭 0·1 갈래 0x17fd8~) — 사기 감소 굴림 하나뿐이고 상승 굴림이 없다 */
export function runMagicTraining(career: PitcherCareer, menu: PitcherTrainingMenu, random: RandomPort): PitcherTrainingOutcome {
  const progress = magicProgressOf(career)
  const rolledMoraleLoss = rollIn(random, MAGIC_MORALE_RANGE)
  const modifiers = trainingModifiersOf(career)
  const moraleLoss = rolledMoraleLoss + trainingMoraleAdjustmentOf(modifiers)
  const spent = spendPitcherCycleAction(gainPitcherMorale(career, -moraleLoss))
  const trained = applyMagicTraining(career, spent, progress)
  return {
    menuId: menu.id,
    gains: {},
    typeBonus: 0,
    moraleLoss,
    rolledGain: 0,
    rolledMoraleLoss,
    modifiers,
    hasSubItemBonus: false,
    magic: progress,
    // 0x18a5c 칸 4 — 해제 카운터 짝(칸 0 · 2 · 3)에 안 맞아 0x18b70 이 다섯 칸을 0 으로
    career: countReleaseTrainingStreak(countPitcherTraining(trained, menu.id), MAGIC_TRAINING_SLOT),
  }
}
