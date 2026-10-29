import { ACE_BATTERS } from '@/entities/game/model/aceOpponent'
import { isOurOffense, runnerAcesFor } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { type BenchClearingOffenseAces, aceRunnerBasesOf } from '@/widgets/field-walk/lib/benchClearingFieldInput'
import type { WalkTeamAces } from '@/widgets/field-walk/lib/walkerAces'

/**
 * 팀 경기 한 팀의 **레코드 타자 배열 차례** — 원본은 `0xb8a34(팀, k)` 로 레코드 배열 `[T+0x18]` 을 차례대로 훑고(0x3fac4 · 0x40008 ·
 * 0x3a5f0 · 0xb0fb4), 대타 0xaebe4 는 명단 team+0xe 와 두 레코드의 자리 니블만 맞바꿔 레코드 배열의 차례는 경기 내내 그대로다.
 * 웹 명단(`ourEntry` · `opponentEntry`)은 선수째 옮기는 타순 차례이고 니블도 선수와 함께 맞바꾸므로(`substituteBatter`), 선수마다
 * 경기를 세울 때의 레코드 첨자로 되돌려 늘어놓는다 — 마선수 아닌 줄은 `recordSlot`(0xb603c 가 다시 매긴 첨자), 마타자는 0xb53f0 이
 * 넣은 9번. 대타로 빠져 명단에서 지워진 선수는 니블이 들어온 벤치 선수 것(붙박이 벤치 니블 0)이라 어느 칸에도 안 맞아 빼도 같지만,
 * 마타자는 그 팀 첫 마타자 그림(0xb8a50)을 정하므로 명단에 없으면 니블 0 으로 9번에 되살린다.
 */
export function teamRecordBattersOf(
  progress: TeamGameProgress,
  ours: boolean,
): readonly { readonly name: string; readonly position: number; readonly ace: number | null }[] {
  const entry = ours ? progress.ourEntry : progress.opponentEntry
  const rows = entry.map((batter, index) => ({
    index: batter.aceIndex >= 0 ? ACE_RECORD_INDEX : (batter.recordSlot ?? index),
    name: batter.name,
    position: batter.position,
    ace: batter.aceIndex >= 0 ? batter.aceIndex : null,
  }))
  const teamAce = ours ? (progress.options.aceBatterId ?? -1) : progress.opponentAceBatterIndex
  if (teamAce >= 0 && !rows.some((row) => row.ace !== null)) {
    rows.push({ index: ACE_RECORD_INDEX, name: ACE_BATTERS[teamAce]?.name ?? '', position: 0, ace: teamAce })
  }
  return [...rows].sort((a, b) => a.index - b.index).map(({ name, position, ace }) => ({ name, position, ace }))
}

/** 마타자가 0xb53f0 으로 들어가는 레코드 칸 (첫 벤치) */
const ACE_RECORD_INDEX = 9

/** 팀 경기 한 팀의 운동장 마선수 재료 — 지금 투수(투수 명단 칸)의 마투수 번호와 레코드 타자 배열 차례(`teamRecordBattersOf`) */
export function teamWalkAcesOf(progress: TeamGameProgress, ours: boolean): WalkTeamAces {
  const pitchers = ours ? progress.ourPitcherEntry : progress.opponentPitcherEntry
  const pitcher = pitchers[ours ? progress.ourPitcherIndex : progress.opponentPitcherIndex]
  return {
    pitcherAce: pitcher !== undefined && pitcher.aceIndex >= 0 ? pitcher.aceIndex : null,
    records: teamRecordBattersOf(progress, ours),
  }
}

/** 벤치 클리어링 공격 줄 재료 — 공격 팀 레코드 · 사구를 맞은 타자(3a97e) · 루 위 마선수 주자(3aa1a, 수비 판 재료 `runnerAcesFor` 의 +0x9c) */
export function benchClearingOffenseOf(progress: TeamGameProgress): BenchClearingOffenseAces {
  const ours = isOurOffense(progress)
  return {
    ...teamWalkAcesOf(progress, ours),
    batter: benchClearingBatterOf(progress),
    aceRunnerBases: aceRunnerBasesOf(runnerAcesFor(progress, ours), progress.game.bases),
  }
}

/** 벤치 클리어링 3a97e — 사구를 맞은 지금 타자가 마타자면 그 자리 니블 · 번호 */
function benchClearingBatterOf(progress: TeamGameProgress): { readonly position: number; readonly ace: number | null } | null {
  const ours = isOurOffense(progress)
  const entry = ours ? progress.ourEntry : progress.opponentEntry
  const batter = entry[ours ? progress.game.battingOrderIndex : progress.opponentOrderIndex]
  return batter === undefined || batter.aceIndex < 0 ? null : { position: batter.position, ace: batter.aceIndex }
}
