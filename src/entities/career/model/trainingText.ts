import type { BatterAbility } from '@/entities/batting/model/batter'
import type { TrainingBlockReason, TrainingOutcome } from '@/entities/career/model/training'

const ABILITY_NAMES: Readonly<Record<keyof BatterAbility, string>> = { hit: '히트', power: '파워', defense: '수비', run: '주루' }

/**
 * 훈련 결과 알림. 원본 결과 표시 위치·모양은 못 찾았다 (layout-re 2차).
 * 능력치 문구는 GP 아이템과 같은 조각(StrMODE[35+k] + 수치 + [83])으로 둔다 (추정).
 *
 * **한 줄에 다 넣지 않고 줄로 나눈다.** 상세정보 창의 메시지 칸은 170×70 이고 줄 간격이 16 이라
 * 네 줄까지 들어가는데, 예전처럼 " · " 로 이어 붙이면 한 줄이 칸을 넘어 잘려 나갔다 (0x8a18a 는 넘친 글을 자른다).
 */
export function trainingOutcomeLinesOf(outcome: TrainingOutcome): string[] {
  const lines: string[] = []
  const progress = outcome.specialSwing
  if (progress === null) {
    const entries = Object.entries(outcome.gains) as [keyof BatterAbility, number][]
    for (const [key, value] of entries) lines.push(`${ABILITY_NAMES[key]} +${value} 상승하였습니다`)
    if (outcome.typeBonus > 0) lines.push(`타입 보너스 +${outcome.typeBonus}`) // StrMODE[194]
  } else if (progress.isLevelUp) {
    lines.push(`${outcome.menuId} 훈련 완료!`) // StrMODE[87]
    lines.push('[선수정보]에서 사용 여부 변경 가능')
  } else {
    lines.push(`[${outcome.menuId}] ${progress.sessions}/${progress.required}회 훈련`) // StrMODE[86]
  }
  lines.push(`사기 -${outcome.moraleLoss}`)
  return lines
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
