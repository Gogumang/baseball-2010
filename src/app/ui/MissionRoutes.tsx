import type { ReactNode } from 'react'
import { batterSideOfForm } from '@/widgets/batting-stage/lib/stageLayout'
import { missionStageBatterOf } from '@/app/model/useMissionSession'
import type { MissionRoutesProps } from '@/app/ui/missionRoutes/missionRoutesProps'
import type { MissionRouteView } from '@/app/ui/missionRoutes/missionRouteView'
import { useMissionRouteScene } from '@/app/ui/missionRoutes/useMissionRouteScene'
import { missionOverlayOf } from '@/app/ui/missionRoutes/missionOverlay'
import { missionBatterNameOf, missionPitcherNameOf } from '@/app/ui/missionRoutes/missionNames'
import { missionSelectScreenOf, playerPickScreenOf } from '@/app/ui/missionRoutes/missionPickScreens'
import { missionPlayScreenOf } from '@/app/ui/missionRoutes/missionPlayScreen'
import { pitchingMissionScreenOf } from '@/app/ui/missionRoutes/pitchingMissionScreen'

export { PitcherAceMatchRoute } from '@/app/ui/missionRoutes/PitcherAceMatchRoute'

/** 타자 미션 벤치 클리어링의 타자 손 — 사구를 맞은 사람 칸 타자 (`missionStageBatterOf` 의 폼) */
function benchBatterHandOf({ session, batter }: MissionRouteView): number | undefined {
  if (session.pendingBenchClearing?.side !== '타자') return undefined
  return batterSideOfForm(missionStageBatterOf(session.pendingBenchClearing.run, batter).look?.form ?? 0)
}

/** 공 사이에 끼어드는 화면 (`missionOverlayOf`) — 이 라우트의 장면 재료로 */
function routeOverlayOf(view: MissionRouteView): ReactNode | null {
  const { screen, session, runner, hallOfFame, nari } = view
  return missionOverlayOf({
    session,
    defenseScene: view.defenseSceneRef,
    playingRun: view.playingRun,
    bannerText: runner.bannerText,
    isFreePassReady: view.isFreePassReady,
    missionBatterName: missionBatterNameOf(session, hallOfFame, nari.타자, screen.kind === '마선수대결'),
    missionPitcherName: missionPitcherNameOf(session, hallOfFame, nari.투수),
    walkerSeats: view.walkerSeats,
    pitchScene: view.pitchScene,
    benchBatterHand: benchBatterHandOf(view),
  })
}

/** 공 사이 화면이 없을 때의 화면 — 선수 고르기 · 타석 · 투구 · 미션 목록 */
function missionScreenOf(view: MissionRouteView, sceneBuntKind: number): ReactNode {
  const { screen, session } = view
  if (screen.kind === '미션선택' && session.player === null) return playerPickScreenOf(view)
  // 이벤트 마선수 대결도 같은 타석 화면이다 — 끝나면 미션 목록 대신 결과 이벤트로 돌아간다
  const isBatterPlay = screen.kind === '미션진행' || screen.kind === '마선수대결'
  if (isBatterPlay && session.missionRun !== null) return missionPlayScreenOf(view, session.missionRun, sceneBuntKind)
  if (screen.kind === '투수미션' && session.pitcherRun !== null) return pitchingMissionScreenOf(view, session.pitcherRun)
  return missionSelectScreenOf(view)
}

/** 미션 모드 화면 분기. 진행 중인 미션이 없으면 선택 화면으로 되돌린다. */
export function MissionRoutes(props: MissionRoutesProps) {
  const { session, batter: nariBatter } = props
  const scene = useMissionRouteScene(props)
  // 치는 타자 — 명예 타자를 고르면 세션의 `hallOfFameBatter` 가 대신한다
  const view: MissionRouteView = { ...props, ...scene, batter: session.hallOfFameBatter ?? nariBatter, actions: session.actions }
  const overlay = routeOverlayOf(view)
  if (overlay !== null) return overlay
  // 장면 +0xfdc 를 이 그림의 값으로 넘긴다 — 타석 화면은 넘겨받은 값이 바뀐 그림에서만 따라간다(키가 고친 값을 덮는 때가 옛 꼴 그대로)
  return missionScreenOf(view, scene.sceneBuntKindRef.current)
}
