import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { countsAsAtBat, isHit } from '@/entities/at-bat/model/atBatOutcome'

export interface SeasonStats {
  readonly games: number
  readonly plateAppearances: number
  readonly atBats: number
  readonly hits: number
  readonly doubles: number
  readonly triples: number
  readonly homeRuns: number
  readonly runsBattedIn: number
  readonly walks: number
  readonly strikeouts: number
  /**
   * 레코드 +0x2c 도루 — 타자편 내 선수가 받는 자리는 동료 타석 간이 엔진 0xc1818 끝(c1a42~c1a98)의 도루뿐이다(내가 루에 있을 때).
   * 기록실 124 타자 열 0x40 · 나리 순위 종류 10 이 읽는다. 옛 저장에는 없어 0 으로 본다.
   */
  readonly stolenBases?: number
}

export const EMPTY_SEASON_STATS: SeasonStats = {
  games: 0,
  plateAppearances: 0,
  atBats: 0,
  hits: 0,
  doubles: 0,
  triples: 0,
  homeRuns: 0,
  runsBattedIn: 0,
  walks: 0,
  strikeouts: 0,
}

/**
 * **타자 레코드 +0x20~+0x2b 여섯 칸** — 웹 시즌 줄(`career.stats`)을 원본 레코드 칸 차례로: 타수 · 안타 · 2루타 · 3루타 · 홈런 · 타점.
 * 미션(모드 6)은 선수 게터 0x1fc20 의 기록을 0xb87cc 가 0x30 바이트 통째 명부에 넣어 이 칸이 그대로 따라오고, 명전 등록 0x1f680 도
 * 통째 베낀다 — 소개 판 0x44944 가 읽는다.
 */
export function batterRecordLineOf(stats: SeasonStats): readonly number[] {
  return [stats.atBats, stats.hits, stats.doubles, stats.triples, stats.homeRuns, stats.runsBattedIn]
}

export function recordAtBat(
  stats: SeasonStats,
  outcome: AtBatOutcome,
  runsBattedIn: number,
): SeasonStats {
  return {
    ...stats,
    plateAppearances: stats.plateAppearances + 1,
    atBats: stats.atBats + (countsAsAtBat(outcome) ? 1 : 0),
    hits: stats.hits + (isHit(outcome) ? 1 : 0),
    doubles: stats.doubles + (outcome.kind === '안타' && outcome.bases === 2 ? 1 : 0),
    triples: stats.triples + (outcome.kind === '안타' && outcome.bases === 3 ? 1 : 0),
    homeRuns: stats.homeRuns + (outcome.kind === '홈런' ? 1 : 0),
    runsBattedIn: stats.runsBattedIn + runsBattedIn,
    walks: stats.walks + (outcome.kind === '볼넷' ? 1 : 0),
    strikeouts: stats.strikeouts + (outcome.kind === '삼진' ? 1 : 0),
  }
}

/**
 * **레코드 +0x20~+0x2c 줄을 뺀 값** — 정산 0xa8024 가 타자 게이트 sp+0x34 = 0xa56dc(ctx, 지금 타자, 0) 가 참일 때만 올리는 칸:
 * +0x20 타수(a887e) · +0x22 안타(a84b2) · +0x24 2루타(a8556) · +0x26 3루타(a8592) · +0x28 홈런(a85e0) · +0x2a 타점(a8974) ·
 * +0x2c 도루(a8362 · c1a42). 모드 3·4 갈래 0xa571c 는 포스트시즌(시즌 객체 +0xb4)이면 거짓이라 이 칸들이 안 오른다.
 * 웹만 세는 칸(경기 · 타석 · 볼넷 · 삼진 — 레코드에 자리가 없다)은 그대로 둔다.
 */
export function withoutRecordLine(stats: SeasonStats): SeasonStats {
  const { stolenBases: _gated, ...rest } = stats
  return { ...rest, atBats: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0, runsBattedIn: 0 }
}

export function recordGamePlayed(stats: SeasonStats): SeasonStats {
  return { ...stats, games: stats.games + 1 }
}

export function mergeStats(left: SeasonStats, right: SeasonStats): SeasonStats {
  return {
    games: left.games + right.games,
    plateAppearances: left.plateAppearances + right.plateAppearances,
    atBats: left.atBats + right.atBats,
    hits: left.hits + right.hits,
    doubles: left.doubles + right.doubles,
    triples: left.triples + right.triples,
    homeRuns: left.homeRuns + right.homeRuns,
    runsBattedIn: left.runsBattedIn + right.runsBattedIn,
    walks: left.walks + right.walks,
    strikeouts: left.strikeouts + right.strikeouts,
    ...(left.stolenBases === undefined && right.stolenBases === undefined
      ? {}
      : { stolenBases: (left.stolenBases ?? 0) + (right.stolenBases ?? 0) }),
  }
}

/** 타수가 0이면 타율은 존재하지 않는다. 0으로 내리면 '0할 타자'라는 거짓 정보가 된다. */
export function battingAverageOf(stats: SeasonStats): number | null {
  return stats.atBats === 0 ? null : stats.hits / stats.atBats
}

export function formatBattingAverage(average: number | null): string {
  return average === null ? '-.---' : average.toFixed(3).replace(/^0/, '')
}
