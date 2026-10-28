import { type GamePitcherLine, chargePitcherLine } from '@/entities/game/model/gamePitcherLines'
import { type GameState, runnersOfGame } from '@/entities/game/model/gameState'
import { settleRunnerPitchers, chargedRunsByPitcher, scoredFromBasesOf } from '@/entities/game/model/runnerPitchers'
import { EMPTY_BASE_RUNNERS } from '@/entities/game/model/baseRunners'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { chargedFromBasesOfFates, runnerFatesWithoutPlay } from '@/features/defense-play/model/runnerFates'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * **우리 공격 플레이 하나의 실점을 책임 투수(주자+0x30)에게** — 정산 주자 루프 0xa8ea4~0xa8f36 이 들어온 주자마다 그 주자를
 * 내보낸 상대 투수의 레코드 +0x22 를 올린다(승계 주자면 앞 투수). 루별 책임 투수 칸(`runnerPitchers`)도 플레이 뒤로 옮긴다 —
 * 새로 나간 타자주자는 지금 마운드 투수(0x46418 → 0xa93ac 넷째 인자 0xae83d).
 * `scoredFromBases` 는 실점을 매길 주자의 투구 때 루(0 = 타자주자). `settles` 가 거짓이면(정산을 안 지나는 판) 칸만 옮긴다.
 */
export function chargeOpponentRunsOf(
  progress: GameProgress,
  lines: readonly GamePitcherLine[],
  after: GameState,
  batter: number | null,
  scoredFromBases: readonly number[],
  settles = true,
): Pick<GameProgress, 'pitcherLines' | 'runnerPitchers'> {
  const before = progress.game
  const sameHalf = after.inning === before.inning && after.half === before.half
  const settled = settleRunnerPitchers({
    tags: progress.runnerPitchers,
    before: runnersOfGame(before),
    after: sameHalf ? runnersOfGame(after) : EMPTY_BASE_RUNNERS,
    batter,
    pitcher: progress.opponentMound.pitcherSlot,
    scoredFromBases: settles ? scoredFromBases : [],
  })
  let pitcherLines = lines
  for (const [pitcherSlot, runsAllowed] of chargedRunsByPitcher(settled.charged)) {
    pitcherLines = chargePitcherLine(pitcherLines, progress.opponentTeamId, pitcherSlot, { runsAllowed })
  }
  return { pitcherLines, runnerPitchers: settled.tags }
}

/**
 * 내 타석이 실점을 매길 주자의 투구 때 루 — 진행기를 돈 판은 그 운명, 삼진 · 볼넷 · 사구 · 홈런은 정산이 보는 목록
 * (`runnerFatesWithoutPlay`), 둘 다 아닌 길(패턴 없이 온 시험 · 옛 호출)은 앞선 주자부터 점수판 득점만큼
 */
export function scoredFromBasesOfMyPlay(
  before: GameState,
  after: GameState,
  outcome: AtBatOutcome,
  defensePlay: DefensePlayResult | null,
  runs: number,
): readonly number[] {
  if (defensePlay !== null) {
    return chargedFromBasesOfFates(defensePlay.runnerFates, before.outs + defensePlay.advance.outsAdded)
  }
  if (outcome.kind === '안타' || outcome.kind === '아웃') {
    const sameHalf = after.inning === before.inning && after.half === before.half
    return scoredFromBasesOf(runnersOfGame(before), sameHalf ? runnersOfGame(after) : EMPTY_BASE_RUNNERS, runs)
  }
  const fates = runnerFatesWithoutPlay(before.bases, outcome)
  return chargedFromBasesOfFates(fates, before.outs + (outcome.kind === '삼진' ? 1 : 0))
}
