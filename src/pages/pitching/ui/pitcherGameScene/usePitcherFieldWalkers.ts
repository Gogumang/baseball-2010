import { useWalkerLineSeats } from '@/widgets/field-walk/lib/useWalkerLineSeats'
import type { PitcherGameOptions, PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { type PitcherFieldLineups, pitcherFieldAcesOf } from '@/pages/pitching/lib/pitcherFieldTeams'
import { currentFieldLineupsOf, pitcherBenchOffenseOf } from './pitcherBench'

type HalfInningBoardSlot = PitcherGameProgress['halfInningBoard']

/** 교대 판이 내 팀 수비 판인가 — 판의 초말이 사람 측의 공격이 아니면 */
export const isOurDefenseBoardOf = (half: '초' | '말', playerSide: number) => (half === '초' ? 0 : 1) !== playerSide

/** 교대 판 열쇠 — 판마다 수비 · 공격 팀 레코드 차례 */
function boardSeatsInputOf(board: HalfInningBoardSlot, fieldLineups: PitcherFieldLineups | undefined, playerSide: number) {
  if (board === null || fieldLineups === undefined) return null
  const boardOurDefense = isOurDefenseBoardOf(board.half, playerSide)
  return {
    key: board.serial,
    defense: boardOurDefense ? fieldLineups.ours : fieldLineups.opponent,
    offense: boardOurDefense ? fieldLineups.opponent : fieldLineups.ours,
  }
}

/** 수비 판 열쇠 — 실시간 판(타구 · 주자 판)이든 재생 판이든 판 하나 */
const playKeyOf = (progress: PitcherGameProgress) => progress.pendingDefensePlay ?? progress.pendingRunnerPlay ?? progress.lastDefensePlay

/** 벤치 클리어링 연출(상태 0x1e)인가 — 붙든 사구가 0x12 대기 · 진입 앞이면 아직 투구 장면이 0x12 를 그린다(A-22) */
export const isBenchClearingSceneOf = (progress: PitcherGameProgress) => progress.pendingBenchClearing?.phase === 'scene'

/**
 * 경기 장면 두 줄의 +0xec (`useWalkerLineSeats`) — 1회초 판 0x3fac4 · 수비 판 시작 0xb0fb4(투수편의 수비 판은 늘 내 팀 수비) ·
 * 벤치 클리어링 0x3a5f0
 */
export function usePitcherFieldWalkers(
  options: PitcherGameOptions,
  progress: PitcherGameProgress,
  recordFieldLineups: PitcherFieldLineups | undefined,
) {
  const board = progress.halfInningBoard
  const fieldLineups = currentFieldLineupsOf(progress, recordFieldLineups)
  const isBenchClearing = isBenchClearingSceneOf(progress)
  const benchOffense = isBenchClearing ? pitcherBenchOffenseOf(progress, options, fieldLineups) : null
  const ourFieldRecords = pitcherFieldAcesOf(progress, options, fieldLineups, true)?.records ?? null
  const walkerSeats = useWalkerLineSeats({
    sceneKey: options,
    playKey: playKeyOf(progress),
    playDefenseRecords: ourFieldRecords,
    board: boardSeatsInputOf(board, fieldLineups, options.playerSide),
    // 진입 0x3a5f0 — 0x12 대기 · 진입 앞 사구는 아직 아니다
    benchClearing: isBenchClearing ? { key: progress.pendingBenchClearing, offense: benchOffense } : null,
  })
  return { fieldLineups, benchOffense, walkerSeats, isBenchClearing }
}
