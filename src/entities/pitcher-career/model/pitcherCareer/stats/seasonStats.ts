/** 투수 시즌 성적 — 레코드 칸 그대로다 */
export interface PitcherSeasonStats {
  /**
   * 등판 경기 수 — ⚠️ **원본에 없는 웹 전용 칸**(표시용). 투수 레코드 0x30 바이트의 시즌 칸 +0x20~+0x2f 는 시즌 시작 0xb6cc4 가
   * 지우는 아홉 칸(+0x20 아웃 · +0x22 실점 · +0x24 세이브 · +0x26 탈삼진 · +0x28 투구 수 · +0x2a 사사구 · +0x2c 스태미나 10000 ·
   * +0x2e 승 · +0x2f 패)으로 다 찼고, 연도 기록도 그 칸을 옮긴 것이며, 기록실 124 의 투수 열 표 0xd1a28 도 방어 · 이닝 · 실점 ·
   * 승 · 패 · 세이브 · 삼진 · 투구수 · 사사구 아홉뿐이다. 원본 칸이 없으니 포스트시즌 게이트도 원본으로 정할 수 없어
   * 등판한 경기마다(포스트시즌 포함) 센다. 읽던 웹 투수편 시즌 끝 화면(웹 전용)은 r71 에서 걷어 지금은 읽는 곳이 없다 —
   * 저장 형식을 바꾸지 않으려고 칸은 남긴다(⚠️ 정리 후보: 걷으려면 옛 저장 이사가 필요하다)
   */
  readonly games: number
  /** +0x20 아웃 */
  readonly outs: number
  /** +0x22 실점 */
  readonly runsAllowed: number
  /** +0x24 세이브 */
  readonly saves: number
  /** +0x26 탈삼진 */
  readonly strikeouts: number
  /** +0x28 투구 수 */
  readonly pitches: number
  /** +0x2e 승 */
  readonly wins: number
  /** +0x2f 패 */
  readonly losses: number
  /**
   * +0x2a 사사구 — 정산 0xa8024 가 볼넷(a8b58) · 사구(a8bd2)마다 수비 팀 지금 투수에게 +1, 0..9999 로 자른다(게이트 없음).
   * 기록실 124 의 투수 열 0x10000 이 읽는다. 옛 저장에는 없어 0 으로 본다(`pitcherWalksOf`).
   */
  readonly walks?: number
}

export const EMPTY_PITCHER_SEASON_STATS: PitcherSeasonStats = {
  games: 0,
  outs: 0,
  runsAllowed: 0,
  saves: 0,
  strikeouts: 0,
  pitches: 0,
  wins: 0,
  losses: 0,
  walks: 0,
}

/** 레코드 +0x2a 사사구 상한 — a8b5a `0x270f` */
const MAXIMUM_PITCHER_WALKS = 9999

/** 시즌 줄의 사사구(+0x2a) — 옛 저장은 칸이 없어 0 */
export function pitcherWalksOf(stats: PitcherSeasonStats): number {
  return stats.walks ?? 0
}

/**
 * **투수 레코드 +0x20~+0x2b 여섯 칸** — 아웃 · 실점 · 세이브 · 탈삼진 · 투구 수 · 사사구. 미션(모드 5)은 0xb8820 이 선수 게터 0x1fbd0 의
 * 기록을 0x30 바이트 통째 명부에 넣고, 명전 등록 0x1f654 도 통째 베낀다 — 소개 판 0x44944 가 읽는다.
 */
export function pitcherRecordLineOf(stats: PitcherSeasonStats): readonly number[] {
  return [stats.outs, stats.runsAllowed, stats.saves, stats.strikeouts, stats.pitches, pitcherWalksOf(stats)]
}

/** 경기 한 판이 시즌 줄에 더하는 몫 — `summaryOf(progress).seasonDelta` 그대로 */
export interface PitcherSeasonDelta {
  readonly outs: number
  readonly runsAllowed: number
  readonly strikeouts: number
  readonly pitches: number
  readonly wins: number
  readonly losses: number
  readonly saves: number
  /** +0x2a 사사구 (`PitcherGameSummary.seasonDelta.walks`). 안 넘기면 0 */
  readonly walks?: number
}

/**
 * 한 경기 몫을 시즌 줄에 더한다 — 경기 결과 반영(`applyPitcherGameResult`)이 시즌 줄 · 통산 줄에 똑같이 쓴다.
 * 등판 경기 수(웹 전용)는 실제로 등판한 경기만, 사사구 +0x2a 는 0..9999 로 자른다(a8b5a).
 */
export function mergeSeasonStats(base: PitcherSeasonStats, delta: PitcherSeasonDelta, entered: boolean): PitcherSeasonStats {
  return {
    games: base.games + (entered ? 1 : 0),
    outs: base.outs + delta.outs,
    runsAllowed: base.runsAllowed + delta.runsAllowed,
    saves: base.saves + delta.saves,
    strikeouts: base.strikeouts + delta.strikeouts,
    pitches: base.pitches + delta.pitches,
    wins: base.wins + delta.wins,
    losses: base.losses + delta.losses,
    walks: Math.min(MAXIMUM_PITCHER_WALKS, pitcherWalksOf(base) + (delta.walks ?? 0)),
  }
}

/** 방어율 × 100 (0xb6ce8) — 경기 화면 밖(성적 화면)에서도 같은 식을 쓴다 */
export function seasonEarnedRunAverageOf(stats: PitcherSeasonStats): number {
  if (stats.outs > 0) return Math.min(9999, Math.trunc((stats.runsAllowed * 2700) / stats.outs))
  return stats.runsAllowed > 0 ? 9999 : 0
}
