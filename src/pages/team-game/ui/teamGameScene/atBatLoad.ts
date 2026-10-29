import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { teamLoadedRunnerAceOf } from '@/pages/team-game/lib/teamAutoRelay'

/** 타석이 선 그림에서 뜬 주자 그림판의 마선수 그림 — 타석 열쇠와 함께 든다 */
export interface AtBatLoad {
  readonly key: readonly unknown[]
  readonly loaded: number | null
}

/** 판 · 중계가 없고 경기가 안 끝난 그림 — 타석이 서 있다 */
function isAtBatStanding(progress: TeamGameProgress): boolean {
  return !(progress.autoRelay != null || progress.pendingDefensePlay !== null || progress.pendingRunnerPlay != null || progress.game.isFinished)
}

/** 타석 열쇠 — 이닝 · 초말 · 두 타순 · 그 칸 선수 · 두 투수 */
function atBatKeyOf(progress: TeamGameProgress): readonly unknown[] {
  const ourOffense = progress.game.half === (progress.game.playerSide === 0 ? '초' : '말')
  const offenseEntry = ourOffense ? progress.ourEntry[progress.game.battingOrderIndex] : progress.opponentEntry[progress.opponentOrderIndex]
  return [
    progress.game.inning,
    progress.game.half,
    progress.game.battingOrderIndex,
    progress.opponentOrderIndex,
    offenseEntry,
    progress.ourPitcherIndex,
    progress.opponentPitcherIndex,
  ]
}

/**
 * 주자 그림판 [장면+0xf24] +0x1c 에 실린 마선수 그림 (`TeamGameScene` 의 `atBatLoad`) — 타석이 선 그림(판 · 중계가 없는)에서 타석 열쇠
 * (이닝 · 초말 · 두 타순 · 그 칸 선수 · 두 투수)가 바뀌면 그때 주자로 떠 둔다. 그 밖의 그림은 앞 값을 그대로 둔다(`useRenderMachine`)
 */
export function advanceAtBatLoad(before: AtBatLoad | null, progress: TeamGameProgress): AtBatLoad | null {
  if (!isAtBatStanding(progress)) return before
  const key = atBatKeyOf(progress)
  const isSameAtBat = before !== null && key.every((value, index) => value === before.key[index])
  return isSameAtBat ? before : { key, loaded: teamLoadedRunnerAceOf(progress) }
}
