import type { MoundPitcherCounters } from '@/entities/pitching/model/pitcherChange'
import { chargePitcherLine, type GamePitcherLine } from '@/entities/game/model/gamePitcherLines'
import { NO_ROSTER_SLOT } from '@/features/play-team-game/model/teamGameRoster'
import { type GameState, runnersOfGame } from '@/entities/game/model/gameState'
import { type BaseRunners, EMPTY_BASE_RUNNERS } from '@/entities/game/model/baseRunners'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { chargedFromBasesOfFates, runnerFatesWithoutPlay } from '@/features/defense-play/model/runnerFates'
import { scoredFromBasesOf, settleRunnerPitchers, chargedRunsByPitcher } from '@/entities/game/model/runnerPitchers'
import { pitcherEntryAt } from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 실점 카운터 A·B 와 투구 수를 올린다 (P7 E1).
 * A(`+0x284`)는 **이닝 교대(0xa5b00)에서 0** 이 되고, B(`+0x280`)는 투수 교체 때만 0 이 된다.
 */
export function addRunsToCounters(counters: MoundPitcherCounters, runs: number, pitches: number, halfChanged: boolean): MoundPitcherCounters {
  return {
    runsAllowed: Math.min(99, counters.runsAllowed + runs),
    inningRunsAllowed: halfChanged ? 0 : Math.min(99, counters.inningRunsAllowed + runs),
    pitches: counters.pitches + pitches,
  }
}

/** 지금 마운드 투수 줄에 더한다 — 붙박이 표 칸이 없는 투수(마투수)는 리그 기록표에 칸이 없어 건너뛴다 */
/**
 * 상대 마운드 삼진 하나 뒤의 `opponentAceStrikeouts` — 지금 상대 투수가 마투수일 때만 센다(붙박이 투수는 `pitcherLines` 가 든다).
 * 정산 0xa8024 의 삼진 콜 0xa7c4c 가 지금 마운드 투수 R[0] 을 올리는 자리와 같다 (`pitcherLines` 의 삼진과 같은 두 곳)
 */
export function opponentAceStrikeoutsAfter(progress: TeamGameProgress, strikeout: boolean): number {
  if (!strikeout) return progress.opponentAceStrikeouts
  const entry = pitcherEntryAt(progress, progress.options.opponentTeamId, progress.opponentPitcherIndex)
  return entry !== undefined && entry.aceIndex >= 0 ? progress.opponentAceStrikeouts + 1 : progress.opponentAceStrikeouts
}

export function chargeMoundLine(
  progress: TeamGameProgress,
  ours: boolean,
  delta: Parameters<typeof chargePitcherLine>[3],
): readonly GamePitcherLine[] {
  return chargeEntryLine(progress, progress.pitcherLines, ours, ours ? progress.ourPitcherIndex : progress.opponentPitcherIndex, delta)
}

/** 투수 명단 `index` 번 투수의 줄에 더한다 (`chargeMoundLine` 의 몸통 — 책임 투수 실점이 지금 마운드가 아닐 때도 쓴다) */
function chargeEntryLine(
  progress: TeamGameProgress,
  lines: readonly GamePitcherLine[],
  ours: boolean,
  index: number,
  delta: Parameters<typeof chargePitcherLine>[3],
): readonly GamePitcherLine[] {
  const teamId = ours ? progress.options.ourTeamId : progress.options.opponentTeamId
  const entry = pitcherEntryAt(progress, teamId, index)
  if (entry === undefined || entry.aceIndex >= 0) return lines
  // 기록을 실어 선 표 밖 투수(영입한 명전·나리)는 원본 id 로 줄을 가른다 (칸 −1)
  if (entry.tableSlot === undefined) {
    return entry.recordId === undefined ? lines : chargePitcherLine(lines, teamId, NO_ROSTER_SLOT, delta, entry.recordId)
  }
  // 줄은 그 투수의 붙박이 표 자리로 — 트레이드로 옮겨 온 투수는 옛 팀이다 (`TeamEntryPitcher.tableTeamId`)
  return chargePitcherLine(lines, entry.tableTeamId ?? teamId, entry.tableSlot, delta)
}

/**
 * 타석 하나가 실점을 매길 주자의 투구 때 루 — 진행기를 돈 판은 그 운명, 사람 장면의 삼진 · 볼넷 · 사구 · 홈런은 정산이 보는
 * 목록(`runnerFatesWithoutPlay`), 간이 엔진 타석(주자가 죽지 않는다)과 그 밖은 앞선 주자부터 점수판 득점만큼
 */
export function scoredFromBasesOfAtBat(
  before: GameState,
  runnersBefore: BaseRunners,
  runnersAfter: BaseRunners,
  outcome: AtBatOutcome,
  defensePlay: DefensePlayResult | null,
  quickEngine: boolean,
  outsAdded: number,
  runs: number,
): readonly number[] {
  if (defensePlay !== null) return chargedFromBasesOfFates(defensePlay.runnerFates, before.outs + outsAdded)
  if (quickEngine || outcome.kind === '안타' || outcome.kind === '아웃') {
    return scoredFromBasesOf(runnersBefore, runnersAfter, runs)
  }
  return chargedFromBasesOfFates(runnerFatesWithoutPlay(before.bases, outcome), before.outs + outsAdded)
}

/**
 * **플레이 하나의 실점을 책임 투수(주자+0x30)에게** — 정산 주자 루프 0xa8ea4~0xa8f36 이 들어온 주자마다 그 주자를 내보낸
 * 수비 팀 투수의 레코드 +0x22 를 올린다(승계 주자면 앞 투수, `entities/game/model/runnerPitchers`). 루별 책임 투수 칸도 플레이
 * 뒤로 옮긴다 — 새로 나간 타자주자는 지금 마운드(0xa93ac 넷째 인자 0xae83d). `settles` 가 거짓이면(정산을 안 지나는 판) 칸만 옮긴다.
 */
export function chargeRunsToResponsible(
  progress: TeamGameProgress,
  lines: readonly GamePitcherLine[],
  after: GameState,
  /** 수비가 우리 팀인가 (상대 공격) */
  oursDefending: boolean,
  batter: number | null,
  scoredFromBases: readonly number[],
  settles = true,
): Pick<TeamGameProgress, 'pitcherLines' | 'runnerPitchers'> {
  const before = progress.game
  const sameHalf = after.inning === before.inning && after.half === before.half
  const runnersOf = (game: GameState, order: number) => (oursDefending ? runnersOfGame(game, order) : runnersOfGame(game))
  const settled = settleRunnerPitchers({
    tags: progress.runnerPitchers,
    before: runnersOf(before, progress.opponentOrderIndex),
    after: sameHalf ? runnersOf(after, progress.opponentOrderIndex) : EMPTY_BASE_RUNNERS,
    batter,
    pitcher: oursDefending ? progress.ourPitcherIndex : progress.opponentPitcherIndex,
    scoredFromBases: settles ? scoredFromBases : [],
  })
  let pitcherLines = lines
  for (const [index, runsAllowed] of chargedRunsByPitcher(settled.charged)) {
    pitcherLines = chargeEntryLine(progress, pitcherLines, oursDefending, index, { runsAllowed })
  }
  return { pitcherLines, runnerPitchers: settled.tags }
}
