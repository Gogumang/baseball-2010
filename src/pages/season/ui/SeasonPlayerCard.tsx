import type { ReactNode } from 'react'
import { SEASON_CARD_RADAR_LABELS } from '@/pages/season/lib/seasonPlayerCard'
import type { SeasonCardAbility } from '@/pages/season/lib/seasonPlayerDetail'
import { TEAMS } from '@/shared/config/original/teams'
import { CardPlate, type HallOfFameFigureLook } from './seasonPlayerCard/otherSlices'
import { useSeasonCardFigurePose } from './seasonPlayerCard/useSeasonCardFigurePose'
import { SeasonCardBadge } from './seasonPlayerCard/SeasonCardBadge'
import { SeasonCardRadar } from './seasonPlayerCard/SeasonCardRadar'
import { SeasonCardFigure } from './seasonPlayerCard/SeasonCardFigure'

export { SeasonCardBadge } from './seasonPlayerCard/SeasonCardBadge'
export { SteppedBoard } from './seasonPlayerCard/SteppedBoard'

export interface SeasonPlayerCardProps {
  readonly teamId: number
  readonly isPitcher: boolean
  /** 그림 vt+8 · vt+0x14 에 넘기는 값 — 폼 · 피부 · 팀(내 팀) · 장비 니블 네 칸 */
  readonly look: HallOfFameFigureLook
  /** 레이더 네 칸 — `seasonCardAbilitiesOf` */
  readonly abilities: readonly SeasonCardAbility[]
  /**
   * 그리기 앞 0x45e8 이 도는가 — 0xd9 · 0xdc(종류 3) 에서만 돈다. 0xda(능력치 상세 창)는 0xae98 을 그대로 그리지만
   * 애니는 멈춘다. 다시 돌면 상태 틱이 0 부터라 애니도 새로 만든다(들어옴 0x5404).
   */
  readonly isAnimating: boolean
  /**
   * 딱지 [gfx+0x168] 이 서 있는가 — 이 장면에서 팀 고르기 0xca · 트레이드 0xe4 를 거쳤으면 참(`seasonPlayerCard.ts` 머리말).
   * 장비 창 0xdc 는 서 있어도 그리지 않는다(0x7bbe2 `cmp #0xdc`).
   */
  readonly hasCardBadge?: boolean
  /** 카드와 그림 사이에 그리는 것 — 0xd9 는 정보 칸 0x7c450 (0xae98 이 카드 · 정보 칸 · 그림 차례로 그린다) */
  readonly children?: ReactNode
}

/** 카드 0x7ba44 시즌 · 선수 갈래 + 선수 그림 (`lib/seasonPlayerCard.ts` 머리말) */
export function SeasonPlayerCard({ teamId, isPitcher, look, abilities, isAnimating, hasCardBadge = false, children }: SeasonPlayerCardProps) {
  const pose = useSeasonCardFigurePose(!isPitcher, look.form, isAnimating)
  return (
    <div data-testid="시즌카드" data-pose={pose}>
      <CardPlate teamId={teamId} testIdPrefix="시즌카드" />
      {TEAMS[teamId] !== undefined && hasCardBadge && <SeasonCardBadge teamId={teamId} />}
      <SeasonCardRadar abilities={abilities} labelFrames={SEASON_CARD_RADAR_LABELS[isPitcher ? '투수' : '타자']} />
      {children}
      <SeasonCardFigure isPitcher={isPitcher} look={look} pose={pose} />
    </div>
  )
}
