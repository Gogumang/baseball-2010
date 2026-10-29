import type { ReactElement } from 'react'
import { SceneMatchupCards } from '@/widgets/matchup-cards/ui/SceneMatchupCards'
import { SubstitutionSceneOverlay } from '@/features/play-game/ui/SubstitutionSceneOverlay'
import type { TeamGameSceneModel } from './useTeamGameSceneModel'

/** 상태 0xe 의 투수·타자 소개 판 0x44944 (`teamMatchupCardsOf`) — 두 타석 장면이 같이 얹는다 */
export function matchupCardsOf(model: TeamGameSceneModel): ReactElement {
  const { matchup } = model
  return <SceneMatchupCards batterHand={matchup.batterHand} pitcher={matchup.pitcher} batter={matchup.batter} />
}

/** 0xd 두 그림을 지나 0xe 에 들어섰으면 소개 판 — 일시정지 창 아래에도 남는다(0x52efe 가 장면 그리기를 건너뛸 뿐이다) */
export function shownMatchupCardsOf(model: TeamGameSceneModel): ReactElement | false {
  return model.isMatchupShown && matchupCardsOf(model)
}

/** 돌발 제안 창 0x1b 의 그리기 0x4a198 은 HUD 0x4c4bc 를 안 부른다 — 결과 창 0x1d(0x4d1e0 → 0x4ce9c)는 부른다 */
export const isHudOmittedOf = (model: TeamGameSceneModel) => model.visibleBurstLines !== null && model.burstState.resolution === null

/** 돌발 창 · 0xe 대기 · 교체 창(상태 0xb) 동안 장면은 멈춘 채 선다 */
export const isStagePausedOf = (model: TeamGameSceneModel) =>
  model.visibleBurstLines !== null || model.confirmFlow.isAwaitingConfirm || model.change.changeWindow !== null

/** 교체 연출 0x16 "CHANGE" (0x4da30) — 서 있을 때만 */
export function substitutionOverlayOf(model: TeamGameSceneModel): ReactElement | null {
  const { substitution } = model.confirmFlow
  if (!substitution.isShown) return null
  return <SubstitutionSceneOverlay key={substitution.serial} aceSlot={substitution.aceSlot} onDone={substitution.finish} />
}
