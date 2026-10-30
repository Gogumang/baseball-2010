import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { type GameState, applyAtBatOutcome } from '@/entities/game/model/gameState'
import { survivorsFromBaseOfFates, chargedFromBasesOfFates } from '@/features/defense-play/model/runnerFates'
import { decisionsAfterPlay } from '@/features/play-game/model/gameDecisions'
import { chargePitcherLine, outsAddedBetween } from '@/entities/game/model/gamePitcherLines'
import { chargeOpponentRunsOf } from '@/features/play-game/model/gameFlow/settlement/chargeRuns'
import { moundsOf } from '@/features/play-game/model/gameFlow/settlement/decisions'
import { MAXIMUM_PITCHER_COUNTER, RUNNER_PLAY_OUTCOME_PLACEHOLDER } from '@/features/play-game/model/gameFlow/types/constants'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/** 판이 아웃 · 득점 · 루를 바꿨나 — 안 바꿨으면 재생 칸 · 장면 칸만 고친다 */
function changesGame(before: GameState, advance: DefensePlayResult['advance']): boolean {
  if (advance.outsAdded > 0 || advance.runsScored > 0) return true
  const { bases } = advance
  return bases.first !== before.bases.first || bases.second !== before.bases.second || bases.third !== before.bases.third
}

/**
 * 주자만 움직인 판(견제 종류 4 · 도루 종류 5 · 폭투 종류 9)의 advance 를 먹인다 — 타석이 끝난 것이 아니라
 * 타순 커서는 그대로다. 득점은 상대 투수 실점 A·B 에 붙는다(득점 처리 0xa5c34). 재생 칸에 판을 넣는다.
 */
export function withRunnerOnlyPlay(
  progress: GameProgress,
  result: DefensePlayResult,
  /**
   * 판정 B 0xae3e8 이 이 판을 정산 0xa8024 로 보내는가 (`arrivalPlaySettles`). 안 보내는 판(삼진 없이 이어지는 폭투·포일 —
   * ae596 → ae5a2)은 정산 칸인 상대 투수 레코드 +0x20 · +0x22 를 안 센다. 득점 처리 0xa5c34(점수판 · A·B)는 그대로다
   */
  settles = true,
  /** 실시간으로 이미 보여 준 판(`pendingRunnerPlay`) — 재생 칸에 다시 안 넣는다 */
  shownLive = false,
): GameProgress {
  const before = progress.game
  let next: GameProgress = {
    ...progress,
    lastDefensePlay: shownLive ? progress.lastDefensePlay : result,
    defenseScene: result.scene,
  }
  const advance = result.advance
  if (!changesGame(before, advance)) return next
  // 결과 코드는 precomputed 가 있으면 안 읽는다
  const game: GameState = {
    ...applyAtBatOutcome(before, RUNNER_PLAY_OUTCOME_PLACEHOLDER, advance, {
      survivorsFromBase: survivorsFromBaseOfFates(result.runnerFates),
    }),
    battingOrderIndex: before.battingOrderIndex,
  }
  const runs = game.ourScore - before.ourScore
  next = {
    ...next,
    game,
    decisions: decisionsAfterPlay(next.decisions, before, game, moundsOf(next)),
    // 주자 판(견제·도루)도 정산 0xa8024 를 지난다 — 아웃은 지금 상대 마운드 투수(a8cb0), 실점은 들어온 주자의 책임 투수(a8ee4)
    ...chargeOpponentRunsOf(
      next,
      settles
        ? chargePitcherLine(next.pitcherLines, next.opponentTeamId, next.opponentMound.pitcherSlot, {
            outs: outsAddedBetween(before, game),
          })
        : next.pitcherLines,
      game,
      null,
      chargedFromBasesOfFates(result.runnerFates, before.outs + advance.outsAdded),
      settles,
    ),
    opponentMound: {
      ...next.opponentMound,
      runsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, next.opponentMound.runsAllowed + runs),
    },
    opponentInningRunsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, next.opponentInningRunsAllowed + runs),
  }
  return next
}
