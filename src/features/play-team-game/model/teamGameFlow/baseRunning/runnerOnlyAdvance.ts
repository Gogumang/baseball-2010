import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { ControlSide } from '@/entities/defense-controls/model/defenseKeys'
import { type GameState, applyAtBatOutcome, runnersOfGame } from '@/entities/game/model/gameState'
import { survivorsFromBaseOfFates, chargedFromBasesOfFates } from '@/features/defense-play/model/runnerFates'
import { applyOpponentRunnerPlay } from '@/features/play-pitcher-game/model/pitcherGameState'
import { decisionsAfterPlay } from '@/features/play-game/model/gameDecisions'
import { scoredFromBasesOf } from '@/entities/game/model/runnerPitchers'
import { EMPTY_BASE_RUNNERS } from '@/entities/game/model/baseRunners'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { moundsOf } from '@/features/play-team-game/model/teamGameFlow/settlement/decisions'
import { addRunsToCounters, chargeMoundLine, chargeRunsToResponsible } from '@/features/play-team-game/model/teamGameFlow/settlement/pitcherLines'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/** `applyAtBatOutcome` 은 `precomputed` 를 받으면 결과 코드를 안 읽는다 — 주자 판에는 타석 결과가 없어 자리만 채운다 */
export const RUNNER_PLAY_OUTCOME_PLACEHOLDER: AtBatOutcome = { kind: '아웃', detail: '땅볼아웃' }

/**
 * **주자만 움직인 판**(견제 종류 4 · 도루 종류 5 · 폭투·포일 종류 9)의 진루·아웃·득점을 경기 상태에 먹인다.
 * 타석이 끝난 것이 아니라 타순 커서는 그대로다(사람 수비면 `applyOpponentRunnerPlay`).
 * 득점 처리 0xa5c34 는 1점마다 수비 팀 실점 A·B 와 승·패·세 칸을 고친다 (타석 정산과 같은 칸).
 * 반 이닝이 넘어갔으면 볼카운트·타석 준비를 내린다 — 다음 타석은 `advance` 가 세운다.
 *
 * `settles` — 판정 B 0xae3e8 이 이 판을 정산 0xa8024 로 보내는가 (`arrivalPlaySettles`). 안 보내는 판(삼진 없이 이어지는
 * 폭투·포일 — ae596 → ae5a2)은 정산 칸인 투수 레코드 +0x20(a8cb0) · +0x22(a8f04) · state[0x8a](a8dd0)를 안 센다.
 * 득점 처리 0xa5c34(점수판 · A·B · 승·패·세)는 정산과 무관하게 돈다.
 */
export function withRunnerOnlyAdvance(
  progress: TeamGameProgress,
  advanceResult: DefensePlayResult['advance'],
  humanSide: ControlSide,
  /** 판의 주자 운명 — 살아남은 주자로 신원을 앉힌다 (`survivorsFromBaseOfFates`) */
  runnerFates?: DefensePlayResult['runnerFates'],
  settles = true,
): { readonly progress: TeamGameProgress; readonly changed: boolean; readonly runs: number } {
  const before = progress.game
  const humanDefends = humanSide === '수비'
  const changed =
    advanceResult.outsAdded > 0 ||
    advanceResult.runsScored > 0 ||
    advanceResult.bases.first !== before.bases.first ||
    advanceResult.bases.second !== before.bases.second ||
    advanceResult.bases.third !== before.bases.third
  if (!changed) return { progress, changed, runs: 0 }
  let game: GameState
  let runs: number
  const runnerHint = runnerFates === undefined ? undefined : { survivorsFromBase: survivorsFromBaseOfFates(runnerFates) }
  if (humanDefends) {
    const applied = applyOpponentRunnerPlay(before, progress.opponentOrderIndex, advanceResult, runnerHint)
    game = applied.game
    runs = applied.runsScored
  } else {
    // 타석이 끝난 것이 아니라 타순 커서는 그대로 둔다
    game = {
      ...applyAtBatOutcome(before, RUNNER_PLAY_OUTCOME_PLACEHOLDER, advanceResult, runnerHint),
      battingOrderIndex: before.battingOrderIndex,
    }
    runs = game.ourScore - before.ourScore
  }
  const halfChanged = game.half !== before.half || game.inning !== before.inning
  const next: TeamGameProgress = {
    ...progress,
    game,
    decisions: decisionsAfterPlay(progress.decisions, before, game, moundsOf(progress)),
    // 주자 판(견제·도루)도 정산 0xa8024 를 지난다 — 아웃은 지금 수비 마운드 투수(a8cb0), 실점은 들어온 주자의 책임 투수(a8ee4)
    ...chargeRunsToResponsible(
      progress,
      settles ? chargeMoundLine(progress, humanDefends, { outs: advanceResult.outsAdded }) : progress.pitcherLines,
      game,
      humanDefends,
      null,
      runnerFates === undefined
        ? scoredFromBasesOf(
            humanDefends ? runnersOfGame(before, progress.opponentOrderIndex) : runnersOfGame(before),
            halfChanged ? EMPTY_BASE_RUNNERS : humanDefends ? runnersOfGame(game, progress.opponentOrderIndex) : runnersOfGame(game),
            runs,
          )
        : chargedFromBasesOfFates(runnerFates, before.outs + advanceResult.outsAdded),
      settles,
    ),
    // 득점 처리 0xa5c34 는 1점마다 수비 팀 A·B 를 올린다 (P7 E1)
    ...(humanDefends
      ? {
          ourPitcherCounters: addRunsToCounters(progress.ourPitcherCounters, runs, 0, halfChanged),
          // state[0x8a] — 정산 a8dd0 이 이 판 득점 [sp+0x28] 을 더한다 (99 상한은 완봉 판정에 안 닿는다)
          pitching: settles ? { ...progress.pitching, runsAllowed: progress.pitching.runsAllowed + runs } : progress.pitching,
        }
      : {
          opponentPitcherCounters: addRunsToCounters(progress.opponentPitcherCounters, runs, 0, halfChanged),
        }),
    ...(halfChanged ? { atBat: createAtBat(), atBatPrepared: false } : {}),
  }
  return { progress: next, changed, runs }
}
