import type { RandomPort } from '@/shared/api/random/randomPort'
import { controlTierOf } from '@/entities/pitching/model/controlTier'
import { GAUGE_LAST_CELL, MAGIC_PITCH_GRADE, gaugeGradeOf, usesGauge } from '@/entities/pitcher-career/model/pitchGauge'
import { MAGIC_PITCH_TYPE_NUMBER } from '@/entities/pitcher-career/model/magicPitch'

export interface PitchGradeInput {
  /** 환경설정 "투구 게이지" 가 켜져 있는가 (설정 +0x2d, **원본 기본값은 꺼짐**) */
  readonly gaugeSettingOn: boolean
  /** 고른 구질 번호 */
  readonly typeNumber: number
  /** 게이지에서 누른 칸 0~9. 안 눌렀으면 0 (그때 등급도 0) */
  readonly gaugeCell: number
  /** 제구 능력치 (체력% 감소까지 반영한 값) */
  readonly effectiveControl: number
  /** 체력 % */
  readonly staminaPercent: number
}

/**
 * 이번 공의 등급 t (0~5).
 *   - 마구(22)는 게이지를 쓰지 않고 늘 5 (0x4dbae)
 *   - 게이지를 쓰면 누른 칸 g → `max(g − 4, 1)`, 안 누르면 0 (0x50e08)
 *   - 게이지를 끄면 제구·체력 확률표 0xd896c (0xb74bc)
 */
export function pitchGradeOf(input: PitchGradeInput, random: RandomPort): number {
  if (input.typeNumber === MAGIC_PITCH_TYPE_NUMBER) return MAGIC_PITCH_GRADE
  const gauge = usesGauge({
    defenseIsHuman: true,
    gaugeSettingOn: input.gaugeSettingOn,
    pitchTypeNumber: input.typeNumber,
  })
  if (gauge) return gaugeGradeOf(input.gaugeCell)
  return controlTierOf(input.effectiveControl, input.staminaPercent !== 0, random)
}

/** 게이지 커서가 도는 칸 수 — 0 에서 시작해 9 까지, 한 틱에 한 칸 (0x4d708) */
export const GAUGE_CELL_COUNT = GAUGE_LAST_CELL + 1
