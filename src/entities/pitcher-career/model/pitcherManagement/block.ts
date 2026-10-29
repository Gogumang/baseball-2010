import { pitcherAbilityLimitsOf } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  MAGIC_MAXIMUM_LEVEL,
  MAGIC_REQUIRED_POPULARITY,
  magicTrainingCellCostOf,
} from '@/entities/pitcher-career/model/pitcherManagement/magic/magicCells'
import type { PitcherTrainingMenu } from '@/entities/pitcher-career/model/pitcherManagement/menus'

export type PitcherTrainingBlockReason = '사기부족' | '능력치최대' | '훈련완료' | '인기도부족'

/**
 * 마구 칸은 **창이 막는다** — 레벨 i 칸은 `i == 배운 수` 일 때만 열리고(StrMODE[63]/[64]),
 * 인기도 조건과 G포인트 부족([65])도 창에 있다 (R7 4절). G 가 모자라면 웹 메뉴는 '훈련완료' 로 막는다
 */
function magicMenuBlockOf(career: PitcherCareer): PitcherTrainingBlockReason | null {
  if (career.magicLevel >= MAGIC_MAXIMUM_LEVEL) return '훈련완료'
  if (career.popularity < (MAGIC_REQUIRED_POPULARITY[career.magicLevel] ?? 0)) return '인기도부족'
  if (career.gamePoint < magicTrainingCellCostOf(career.magicLevel)) return '훈련완료'
  return null
}

/** 막힘 판정 — 사기 0 이면 StrMODE[193], 능력치가 한계면 [192] (0x12e40), 마구 칸은 창의 조건 */
export function pitcherTrainingBlockReasonOf(career: PitcherCareer, menu: PitcherTrainingMenu): PitcherTrainingBlockReason | null {
  // 행동함(S+4)은 보지 않는다 — 107 키 0x12d48 확인(12d8a~)은 사기 0xa3a25 만 본다
  if (career.morale <= 0) return '사기부족'
  if (menu.ability === null) return magicMenuBlockOf(career)
  const limits = pitcherAbilityLimitsOf(career)
  return career.ability[menu.ability] >= limits[menu.ability] ? '능력치최대' : null
}
