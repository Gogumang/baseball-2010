import { ACCEPTS_ANY_SLOT, accumulatePitcherLines } from '@/entities/league/model/leaguePlayerStats/pitchers/accumulatePitchers'
import type { LeaguePitcherAppearance } from '@/entities/league/model/leaguePlayerStats/types/events'
import type { LeaguePitcherLine } from '@/entities/league/model/leaguePlayerStats/types/pitcherLine'
import type { LeaguePlayerStats } from '@/entities/league/model/leaguePlayerStats/types/playerStats'

/** 원본 투구 수 칸은 u16 을 0~9999 에서 자른다 (P1 3-1 · 6절) */
const MAXIMUM_PITCH_COUNT = 9999

function addPitcherAppearance(line: LeaguePitcherLine, appearance: LeaguePitcherAppearance): LeaguePitcherLine {
  return {
    outs: line.outs + appearance.outs,
    runsAllowed: line.runsAllowed + appearance.runsAllowed,
    // 원본에서 세이브는 늘 0 이다 — 판정이 `'세'` 를 내지 않는다 (B-10, `LeaguePitcherLine.saves` 주석)
    saves: line.saves + (appearance.decision === '세' ? 1 : 0),
    strikeouts: line.strikeouts + appearance.strikeouts,
    pitches: Math.min(MAXIMUM_PITCH_COUNT, line.pitches + appearance.pitches),
    wins: line.wins + (appearance.decision === '승' ? 1 : 0),
    losses: line.losses + (appearance.decision === '패' ? 1 : 0),
    // +0x2a 사사구는 게이트 밖 칸이라 따로 쌓는다 (`recordLeagueFreePasses`) — 여기서는 그대로 둔다
    ...(line.walks === undefined ? {} : { walks: line.walks }),
  }
}

/**
 * 등판 여러 개를 한 번에 쌓는다 — 타자 쪽 `recordLeaguePlateAppearances` 와 짝이다.
 * 원본은 투구·아웃마다 레코드를 건드리지만(0xa5e14·0xa8cca) 결과는 같다.
 */
export function recordLeaguePitcherAppearances(stats: LeaguePlayerStats, appearances: readonly LeaguePitcherAppearance[]): LeaguePlayerStats {
  if (appearances.length === 0) return stats
  return accumulatePitcherLines(stats, appearances, addPitcherAppearance, ACCEPTS_ANY_SLOT)
}
