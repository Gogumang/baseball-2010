import { gameBenchOffenseOf, gameFieldTeamsOf } from '@/pages/game/lib/gameFieldTeams'
import { useWalkerLineSeats } from '@/widgets/field-walk/lib/useWalkerLineSeats'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { GameRouteProps } from '@/app/ui/gameRoute/gameRouteProps'

type FieldTeams = ReturnType<typeof gameFieldTeamsOf>

/** 교대 판 0x3fac4 — 공격 · 수비 줄은 판의 반 이닝이 내 공격인지로 정한다 */
function walkerBoardOf(progress: GameProgress, fieldTeams: FieldTeams) {
  const boardNow = progress.halfInningBoard ?? null
  if (boardNow === null) return null
  const boardOursOffense = (boardNow.half === '초' ? 0 : 1) === progress.game.playerSide
  return {
    key: boardNow.serial,
    defense: (boardOursOffense ? fieldTeams.opponent : fieldTeams.ours).aces.records,
    offense: (boardOursOffense ? fieldTeams.ours : fieldTeams.opponent).aces.records,
  }
}

/** 진입 0x3a5f0 — 0x12 대기 · 진입 앞 사구는 아직 아니다 */
function benchClearingSeatsOf(progress: GameProgress, fieldTeams: FieldTeams) {
  if (progress.pendingBenchClearing?.phase !== 'scene') return null
  return { key: progress.pendingBenchClearing, offense: gameBenchOffenseOf(fieldTeams.ours, progress) }
}

interface WalkerSeatsInput extends Pick<GameRouteProps, 'progress' | 'career'> {
  readonly sceneSerial: number
  readonly runnerPlay: GameProgress['pendingRunnerPlay'] | null
  readonly play: GameProgress['lastDefensePlay']
}

/**
 * 경기 장면 두 줄의 +0xec (`useWalkerLineSeats`) — 교대 판 0x3fac4(1회초 판) · 수비 판 시작 0xb0fb4 · 벤치 클리어링 0x3a5f0.
 * 타자편의 수비 판은 늘 내 타석이라 수비 팀은 상대다. GameScreen 은 수비 재생 동안 내려가므로 여기서 든다
 */
export function useGameWalkerSeats({ progress, career, sceneSerial, runnerPlay, play }: WalkerSeatsInput) {
  const fieldTeams = gameFieldTeamsOf(career, progress)
  return useWalkerLineSeats({
    sceneKey: sceneSerial,
    playKey: progress.pendingDefensePlay ?? runnerPlay ?? play,
    playDefenseRecords: fieldTeams.opponent.aces.records,
    board: walkerBoardOf(progress, fieldTeams),
    benchClearing: benchClearingSeatsOf(progress, fieldTeams),
  })
}
