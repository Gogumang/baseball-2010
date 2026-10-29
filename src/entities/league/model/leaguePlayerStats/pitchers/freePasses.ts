import { PITCHERS_PER_TEAM } from '@/entities/league/model/leaguePlayerStats/otherSlices'
import { accumulatePitcherLines } from '@/entities/league/model/leaguePlayerStats/pitchers/accumulatePitchers'
import type { LeaguePitcherWalkLine } from '@/entities/league/model/leaguePlayerStats/types/events'
import type { LeaguePitcherLine } from '@/entities/league/model/leaguePlayerStats/types/pitcherLine'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats/types/playerStats'

/** a8b5a · a8bd4 의 `0x270f` 상한 */
const WALK_LIMIT = 9999

const walksOf = (line: LeaguePitcherWalkLine) => line.walks ?? 0
const isTablePitcherSlot = (pitcherSlot: number) => pitcherSlot >= 0 && pitcherSlot < PITCHERS_PER_TEAM

const addWalks = (line: LeaguePitcherLine, walkLine: LeaguePitcherWalkLine): LeaguePitcherLine => ({
  ...line,
  walks: Math.min(WALK_LIMIT, (line.walks ?? 0) + walksOf(walkLine)),
})

/**
 * 사사구(+0x2a)를 쌓는다 — 정산 0xa8024 꼬리 a8b04~a8bee 는 앞머리 게이트 0xa56dc 를 안 보므로 **정규시즌 · 포스트시즌을 가리지
 * 않는다**(투수 줄 `recordLeaguePitcherAppearances` 는 게이트 안이라 따로 부른다). 붙박이 표 밖 칸(내 육성 선수 · 마선수)은 건너뛴다.
 */
export function recordLeagueFreePasses(stats: LeaguePlayerStats, lines: readonly LeaguePitcherWalkLine[]): LeaguePlayerStats {
  const walked = lines.filter((line) => walksOf(line) > 0)
  if (walked.length === 0) return stats
  return accumulatePitcherLines(stats, walked, addWalks, isTablePitcherSlot)
}
