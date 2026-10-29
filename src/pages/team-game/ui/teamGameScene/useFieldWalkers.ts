import { useRef, useState } from 'react'
import { useWalkerLineSeats } from '@/widgets/field-walk/lib/useWalkerLineSeats'
import type { HalfInningWalkState } from '@/widgets/field-walk/lib/halfInningWalk'
import type { BenchClearingWalkState } from '@/widgets/field-walk/lib/benchClearingWalk'
import { useRenderMachine } from '@/shared/lib/renderMachine/useRenderMachine'
import { isOurOffense } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameOptions, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { useFieldCarryTrack } from '@/pages/team-game/model/useFieldCarryTrack'
import type { TeamGameSession } from '@/pages/team-game/model/useTeamGame'
import { type AtBatLoad, advanceAtBatLoad } from './atBatLoad'
import { benchClearingOffenseOf, teamWalkAcesOf } from './teamWalkAces'

/** 중계 번호 — 중계가 서 있지 않으면 null */
const autoRelaySerialOf = (progress: TeamGameProgress) => progress.autoRelay?.serial ?? null

/** 진행의 공수 교대 판 칸 — 판이 서 있으면 그 판 */
type HalfInningBoardSlot = TeamGameProgress['halfInningBoard']

/** 장면 두 줄 +0xec 의 공수 교대 판 열쇠 — 판마다 수비 · 공격 팀 레코드 */
function boardSeatsInputOf(progress: TeamGameProgress, board: HalfInningBoardSlot) {
  if (board === null) return null
  return {
    key: board.serial,
    defense: teamWalkAcesOf(progress, !isOurOffense(progress)).records,
    offense: teamWalkAcesOf(progress, isOurOffense(progress)).records,
  }
}

/** 수비 판 열쇠 — 실시간 갈래(`pendingDefensePlay` · `pendingRunnerPlay`)든 재생 갈래(`lastDefensePlay`)든 판 하나 */
function playKeyOf(session: TeamGameSession, play: TeamGameProgress['lastDefensePlay']) {
  return session.pendingDefensePlay ?? session.progress.pendingRunnerPlay ?? play
}

/** 벤치 클리어링 진입 0x3a5f0 의 열쇠 — 0x12 대기 · 진입 앞 사구는 아직 아니다 */
function benchSeatsInputOf(progress: TeamGameProgress, offense: ReturnType<typeof benchClearingOffenseOf> | null) {
  const bench = progress.pendingBenchClearing
  return bench?.phase === 'scene' ? { key: bench, offense } : null
}

/** 벤치 클리어링 공격 줄 재료 — 연출 단계에서만 */
function benchOffenseOf(progress: TeamGameProgress) {
  return progress.pendingBenchClearing?.phase === 'scene' ? benchClearingOffenseOf(progress) : null
}

/** 메뉴 자동진행 칸을 걷는 그림 — 중계가 아닌데 칸이 남아 있다 */
const isMenuRelayStale = (progress: TeamGameProgress, loaded: number | null | undefined) => progress.autoRelay == null && loaded !== undefined

/**
 * 운동장을 걷는 그림의 이어지는 칸 — 수비 줄 자리 · 카메라(`useFieldCarryTrack`) · 판 걸음 칸 · 실린 주자 마선수 그림 · 두 줄 +0xec.
 * 판 · 중계는 선 그림에서 이어 받는다.
 */
export function useFieldWalkers(options: TeamGameOptions, session: TeamGameSession, play: TeamGameProgress['lastDefensePlay']) {
  const { progress } = session
  const board = progress.halfInningBoard
  /** 장면 +0x111c 수비 줄 자리 · 카메라 +0x1e8 (`useFieldCarryTrack`) — 판 · 중계는 선 그림에서 이어 받는다 */
  const fieldCarryTrack = useFieldCarryTrack()
  const fieldCarry = fieldCarryTrack.followRender(play, autoRelaySerialOf(progress))
  const boardWalkRef = useRef<HalfInningWalkState | null>(null)
  const benchWalkRef = useRef<BenchClearingWalkState | null>(null)
  /**
   * 주자 그림판 [장면+0xf24] +0x1c 에 실린 마선수 그림 — 타석 0xd 진입 0x48d50 이 48ddc 예약 확정 뒤 48e90 0x47cc8 로 싣는다(직접 뜸, r215).
   * 0xd 는 새 타석 · 교체 연출 0x16 뒤(대타 · 투수 교체)에 서고, 타석 사이 도루 · 견제 · 폭투는 다시 싣지 않는다. 메뉴 자동진행(0x3c8da)은
   * 0x47cc8 을 안 거쳐 이 값이 중계 첫 그림에 남는다(`TeamAutoRelay.entryLoadedRunnerAce`). 웹은 타석이 선 그림(판 · 중계가 없는)마다
   * 타석 열쇠(이닝 · 초말 · 두 타순 · 그 칸 선수 · 두 투수)가 바뀌면 그때 주자로 떠 둔다.
   */
  const atBatLoad = useRenderMachine<AtBatLoad | null, TeamGameProgress>(advanceAtBatLoad, progress)
  /** 메뉴 자동진행으로 들어설 때 넘길 실린 그림 — 중계가 아닌 그림에서는 걷는다(렌더 중 맞추기) */
  const [menuRelayLoaded, setMenuRelayLoaded] = useState<number | null | undefined>(undefined)
  if (isMenuRelayStale(progress, menuRelayLoaded)) setMenuRelayLoaded(undefined)
  /**
   * 장면 두 줄의 +0xec (`useWalkerLineSeats`) — 교대 판 0x3fac4 · 수비 판 시작 0xb0fb4 · 벤치 클리어링 0x3a5f0 이 차례로 적는다.
   * 수비 판은 실시간 갈래(`pendingDefensePlay` · `pendingRunnerPlay`)든 재생 갈래(`lastDefensePlay`)든 판 하나마다 그 판 앞 그림의 수비 팀으로 훑는다
   */
  const benchOffense = benchOffenseOf(progress)
  const walkerSeats = useWalkerLineSeats({
    sceneKey: options,
    playKey: playKeyOf(session, play),
    playDefenseRecords: teamWalkAcesOf(progress, !isOurOffense(progress)).records,
    board: boardSeatsInputOf(progress, board),
    benchClearing: benchSeatsInputOf(progress, benchOffense),
  })
  return { fieldCarryTrack, fieldCarry, boardWalkRef, benchWalkRef, atBatLoad, menuRelayLoaded, setMenuRelayLoaded, benchOffense, walkerSeats }
}
