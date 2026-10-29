import { useWalkerLineSeats } from '@/widgets/field-walk/lib/useWalkerLineSeats'
import { missionWalkTeamOf } from '@/entities/mission/model/missionRunners'
import type { MissionRun } from '@/entities/mission/model/missionRun'
import type { PitcherRun } from '@/entities/mission/model/pitcherRun'
import type { Screen } from '@/app/model/screen'
import { missionBenchOffenseOf } from '@/app/ui/missionRoutes/missionStage'
import type { MissionRoutesProps } from '@/app/ui/missionRoutes/missionRoutesProps'

type MissionSession = MissionRoutesProps['session']
type PlayingRun = MissionRun | PitcherRun | null

/** 첫 0x18 판 0x3fac4 — 수비 줄 · 공격 줄 팀 각각 */
function walkerBoardOf(session: MissionSession, playingRun: PlayingRun) {
  if (session.halfInningBoard === null || playingRun === null) return null
  return {
    key: session.halfInningBoard.serial,
    defense: missionWalkTeamOf(playingRun, true)?.records ?? [],
    offense: missionWalkTeamOf(playingRun, false)?.records ?? [],
  }
}

/** 진입 0x3a5f0 — 0x12 대기 · 진입 앞 사구는 아직 아니다 */
function benchClearingSeatsOf(session: MissionSession) {
  const benchRun = session.pendingBenchClearing?.phase === 'scene' ? session.pendingBenchClearing.run : null
  if (session.pendingBenchClearing === null || benchRun === null) return null
  return { key: session.pendingBenchClearing, offense: missionBenchOffenseOf(benchRun) }
}

function playDefenseRecordsOf(playingRun: PlayingRun) {
  if (playingRun === null) return null
  return missionWalkTeamOf(playingRun, true)?.records ?? null
}

/**
 * 미션 경기 장면 두 줄의 +0xec (`useWalkerLineSeats`) — 미션 시작 첫 0x18 판 0x3fac4 · 사람 반 이닝의 수비 판 시작 0xb0fb4 ·
 * 투수 미션 벤치 클리어링 0x3a5f0. 자동진행 0x21 이 돌아온 0x18 은 판 없이 지나가 0x3fac4 를 안 부른다(Q2)
 */
export function useMissionWalkerSeats(session: MissionSession, playScreen: Screen | null, playingRun: PlayingRun) {
  return useWalkerLineSeats({
    sceneKey: playScreen,
    playKey: session.pendingDefensePlay ?? session.pendingRunnerPlay ?? session.pickoffReplay,
    playDefenseRecords: playDefenseRecordsOf(playingRun),
    board: walkerBoardOf(session, playingRun),
    benchClearing: benchClearingSeatsOf(session),
  })
}
