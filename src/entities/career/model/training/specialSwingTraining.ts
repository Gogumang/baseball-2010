import type { RandomPort } from '@/shared/api/random/randomPort'
import { BALANCE } from '@/shared/config/original/balance'
import { BATTER_BURSTS } from '@/shared/config/original/bursts'
import { gainMorale, spendCycleAction } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { trainingMoraleAdjustmentOf } from '@/entities/career/model/trainingText'
import { trainingModifiersOf } from '@/entities/career/model/training/modifiers'
import { SPECIAL_SWING_GAME_POINT_COST, SPECIAL_SWING_REQUIRED_SESSIONS } from '@/entities/career/model/training/specialSwingSlots'
import {
  learnedSpecialNumberOf,
  rollInRange,
  type IntegerRange,
  type TrainingMenu,
  type TrainingOutcome,
} from '@/entities/career/model/training/types'

const SPECIAL_SWING_MORALE_RANGE: IntegerRange = BALANCE.specialSwing.moraleLossRange

export function rollSpecialSwingTraining(career: PlayerCareer, menu: TrainingMenu, random: RandomPort): TrainingOutcome {
  const level = career.specialSwingLevel
  const required = SPECIAL_SWING_REQUIRED_SESSIONS[level]
  const sessions = career.specialSwingSessions + 1
  const isLevelUp = sessions >= required
  const rolledMoraleLoss = rollInRange(random, SPECIAL_SWING_MORALE_RANGE)
  const modifiers = trainingModifiersOf(career)
  const moraleLoss = rolledMoraleLoss + trainingMoraleAdjustmentOf(modifiers)
  const spent = spendCycleAction(gainMorale(career, -moraleLoss))
  const trained: PlayerCareer = {
    ...spent,
    // G포인트는 0 에서 바닥을 친다 (0xa3c84)
    gamePoint: Math.max(0, career.gamePoint - SPECIAL_SWING_GAME_POINT_COST[level]),
    specialSwingLevel: isLevelUp ? level + 1 : level,
    specialSwingSessions: isLevelUp ? 0 : sessions,
    // 0x1816c — 훈련 완료면 그 기술을 고른 번호로
    ...(isLevelUp ? { specialSwingNumber: learnedSpecialNumberOf(level) } : {}),
  }
  const number = learnedSpecialNumberOf(level)
  return {
    menuId: menu.id,
    gains: {},
    typeBonus: 0,
    moraleLoss,
    rolledGain: 0,
    rolledMoraleLoss,
    modifiers,
    hasSubItemBonus: false,
    specialSwing: {
      sessions,
      required,
      isLevelUp,
      name: BATTER_BURSTS[number - 1 + (number === 4 ? career.battingTypeIndex : 0)] ?? '',
    },
    career: trained,
  }
}
