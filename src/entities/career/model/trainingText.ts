import type { BatterAbility } from '@/entities/batting/model/batter'
import type { TrainingBlockReason, TrainingOutcome } from '@/entities/career/model/training'

const ABILITY_NAMES: Readonly<Record<keyof BatterAbility, string>> = { hit: '히트', power: '파워', defense: '수비', run: '주루' }

/**
 * 훈련 결과 알림. 원본 결과 표시 위치·모양은 못 찾았다 (layout-re 2차).
 * 능력치 문구는 GP 아이템과 같은 조각(StrMODE[35+k] + 수치 + [83])으로 둔다 (추정).
 */
export function trainingOutcomeTextOf(outcome: TrainingOutcome): string {
  const parts: string[] = []
  const progress = outcome.specialSwing
  if (progress === null) {
    const entries = Object.entries(outcome.gains) as [keyof BatterAbility, number][]
    parts.push(entries.map(([key, value]) => `${ABILITY_NAMES[key]} +${value} 상승하였습니다`).join(' · '))
    if (outcome.typeBonus > 0) parts.push(`타입 보너스 +${outcome.typeBonus}`) // StrMODE[194]
  } else if (progress.isLevelUp) {
    parts.push(`${outcome.menuId} 훈련 완료! [선수정보]에서 사용 여부 변경 가능`) // StrMODE[87]
  } else {
    parts.push(`[${outcome.menuId}] ${progress.sessions}/${progress.required}회 훈련`) // StrMODE[86]
  }
  parts.push(`사기 -${outcome.moraleLoss}`)
  return parts.join(' · ')
}

export function trainingBlockTextOf(reason: TrainingBlockReason, menuName: string): string {
  switch (reason) {
    case '사기부족':
      return '사기가 0일 때는 훈련을 할 수 없습니다' // StrMODE[193]
    case '능력치최대':
      return `[${menuName}] 능력치가 최대입니다` // StrMODE[192]
    case '훈련완료':
      return `${menuName} 훈련을 모두 마쳤습니다` // 원문 미확인 (추정)
    case '이미행동함':
      return '트레이닝·휴식·외출은 한 번에 한 가지만 할 수 있습니다'
  }
}
