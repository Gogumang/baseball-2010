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
import { isSameHalfInning } from '@/features/play-team-game/model/teamGameFlow/inningChange/halfInning'
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
  const changed = hasRunnerPlayMoved(before, advanceResult)
  if (!changed) return { progress, changed, runs: 0 }
  const humanDefends = humanSide === '수비'
  const runnerHint = runnerFates === undefined ? undefined : { survivorsFromBase: survivorsFromBaseOfFates(runnerFates) }
  const { game, runs } = humanDefends
    ? opponentRunnerPlayOf(progress, advanceResult, runnerHint)
    : ourRunnerPlayOf(before, advanceResult, runnerHint)
  const halfChanged = !isSameHalfInning(before, game)
  const scoredFromBases =
    runnerFates === undefined
      ? scoredFromBasesWithoutFates(progress, game, humanDefends, halfChanged, runs)
      : chargedFromBasesOfFates(runnerFates, before.outs + advanceResult.outsAdded)
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
      scoredFromBases,
      settles,
    ),
    // 득점 처리 0xa5c34 는 1점마다 수비 팀 A·B 를 올린다 (P7 E1)
    ...(humanDefends ? ourDefenseRunsAfter(progress, runs, halfChanged, settles) : opponentDefenseRunsAfter(progress, runs, halfChanged)),
    ...(halfChanged ? { atBat: createAtBat(), atBatPrepared: false } : {}),
  }
  return { progress: next, changed, runs }
}

type RunnerHint = Parameters<typeof applyAtBatOutcome>[3]

/** 판이 아웃 · 득점 · 루 중 하나라도 바꿨는가 — 안 바꿨으면 경기 상태를 건드리지 않는다 */
function hasRunnerPlayMoved(before: GameState, advanceResult: DefensePlayResult['advance']): boolean {
  if (advanceResult.outsAdded > 0 || advanceResult.runsScored > 0) return true
  const { first, second, third } = advanceResult.bases
  return first !== before.bases.first || second !== before.bases.second || third !== before.bases.third
}

/** 사람 수비 — 상대 공격 판. 타순 커서는 그대로다 (`applyOpponentRunnerPlay`) */
function opponentRunnerPlayOf(
  progress: TeamGameProgress,
  advanceResult: DefensePlayResult['advance'],
  runnerHint: RunnerHint,
): { readonly game: GameState; readonly runs: number } {
  const applied = applyOpponentRunnerPlay(progress.game, progress.opponentOrderIndex, advanceResult, runnerHint)
  return { game: applied.game, runs: applied.runsScored }
}

/** 사람 공격 — 우리 공격 판. 타석이 끝난 것이 아니라 타순 커서는 그대로 둔다 */
function ourRunnerPlayOf(
  before: GameState,
  advanceResult: DefensePlayResult['advance'],
  runnerHint: RunnerHint,
): { readonly game: GameState; readonly runs: number } {
  const game = {
    ...applyAtBatOutcome(before, RUNNER_PLAY_OUTCOME_PLACEHOLDER, advanceResult, runnerHint),
    battingOrderIndex: before.battingOrderIndex,
  }
  return { game, runs: game.ourScore - before.ourScore }
}

/** 판 운명이 없는 옛 길 — 앞선 주자부터 점수판 득점만큼 (공격 팀 타순으로 루 위 신원을 읽는다) */
function scoredFromBasesWithoutFates(
  progress: TeamGameProgress,
  game: GameState,
  humanDefends: boolean,
  halfChanged: boolean,
  runs: number,
): readonly number[] {
  const runnersOf = (state: GameState) => (humanDefends ? runnersOfGame(state, progress.opponentOrderIndex) : runnersOfGame(state))
  return scoredFromBasesOf(runnersOf(progress.game), halfChanged ? EMPTY_BASE_RUNNERS : runnersOf(game), runs)
}

/** 우리가 수비한 판의 실점 칸 — A·B 와, 정산을 지나면 state[0x8a] (정산 a8dd0 이 이 판 득점 [sp+0x28] 을 더한다 · 99 상한은 완봉 판정에 안 닿는다) */
function ourDefenseRunsAfter(
  progress: TeamGameProgress,
  runs: number,
  halfChanged: boolean,
  settles: boolean,
): Pick<TeamGameProgress, 'ourPitcherCounters' | 'pitching'> {
  return {
    ourPitcherCounters: addRunsToCounters(progress.ourPitcherCounters, runs, 0, halfChanged),
    pitching: settles ? { ...progress.pitching, runsAllowed: progress.pitching.runsAllowed + runs } : progress.pitching,
  }
}

/** 상대가 수비한 판의 실점 칸 — 상대 투수 A·B 만 */
function opponentDefenseRunsAfter(progress: TeamGameProgress, runs: number, halfChanged: boolean): Pick<TeamGameProgress, 'opponentPitcherCounters'> {
  return { opponentPitcherCounters: addRunsToCounters(progress.opponentPitcherCounters, runs, 0, halfChanged) }
}
