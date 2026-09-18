import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { EMPTY_SEASON_STATS, recordAtBat } from '@/entities/career/model/seasonStats'
import type { SeasonStats } from '@/entities/career/model/seasonStats'
import { atBatRecordIdsOf } from '@/entities/game/model/gameRecords'

/**
 * 한 타자의 이 경기 기록 — 기록달성(0xa77f0) 판정에 필요한 만큼만 들고 있다.
 *
 * 원본은 기록을 **팀 단위로** 센다: 0xa77f0 의 게이트는 "공격 팀이 사람 팀인가" 만 보고,
 * 0xa8024 의 "본인인가" 필터는 개인 통산 성적 증가만 감싼다. 그래서 **동료 여덟 타순의
 * 3루타·홈런 단계·연타석·사이클링·볼넷도 G포인트로 들어온다.**
 * 그래서 사용자와 동료가 같은 함수를 쓴다.
 */
export interface BatterGameLog {
  readonly stats: SeasonStats
  /** 이어진 연타석 안타 수 — 볼넷도 끊는다 (0xa75f4) */
  readonly consecutiveHits: number
}

export const EMPTY_BATTER_GAME_LOG: BatterGameLog = {
  stats: EMPTY_SEASON_STATS,
  consecutiveHits: 0,
}

export function isCycleOf(stats: SeasonStats): boolean {
  const singles = stats.hits - stats.doubles - stats.triples - stats.homeRuns
  return singles > 0 && stats.doubles > 0 && stats.triples > 0 && stats.homeRuns > 0
}

export interface BatterAtBatRecord {
  readonly log: BatterGameLog
  /** 이 타석에서 달성한 기록 id */
  readonly recordIds: readonly number[]
}

/** 타석 하나를 타자 기록에 반영하고, 그때 달성된 기록 id 를 함께 돌려준다 */
export function recordBatterAtBat(
  log: BatterGameLog,
  outcome: AtBatOutcome,
  runsBattedIn: number,
): BatterAtBatRecord {
  const stats = recordAtBat(log.stats, outcome, runsBattedIn)
  const isHit = outcome.kind === '안타' || outcome.kind === '홈런'
  const consecutiveHits = isHit ? log.consecutiveHits + 1 : 0
  const recordIds = atBatRecordIdsOf({
    outcome,
    runsScored: runsBattedIn,
    consecutiveHits,
    homeRunsInGame: stats.homeRuns,
    walksInGame: stats.walks,
    completesCycle: !isCycleOf(log.stats) && isCycleOf(stats),
  })

  return { log: { stats, consecutiveHits }, recordIds }
}
