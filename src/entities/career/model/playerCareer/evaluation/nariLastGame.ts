import type { GameSummary } from '@/entities/game/model/gameSummary'
import type { GameEvaluation } from '@/entities/career/model/gameEvaluation'

/**
 * **116 경기 뒤 평가를 다시 띄울 재료** — 원본은 S 의 칸(+0x4a 지난 경기 인기도 변화 · +0x1d8 이 경기 기록 바이트)이 저장에 남아
 * 이어하기(S+0x50 == 2)가 116 진입 0x1278c 를 그대로 다시 돈다. 웹은 그 칸 대신 지난 경기 요약(리그 기록 재료는 뺀다)과
 * 평가를 둔다. 경기마다 덮어쓴다.
 */
export interface NariLastGame {
  readonly summary: Omit<GameSummary, 'leaguePlateAppearances' | 'leagueStolenBases' | 'leagueErrors' | 'leaguePitchers' | 'pitcherStaminas'>
  /**
   * 116 이 읽는 S+0x4a · +0x64 · +7 과 그 감독 글. 평가 0xa719c 가 도는 정규시즌 경기만 덮어쓰므로 포스트시즌 경기 뒤에는
   * **앞 평가 경기 값**이다(감독 글은 116 이 그 +0x4a 와 지금 평판으로 다시 고른다).
   */
  readonly evaluation: GameEvaluation
  /**
   * S+0x1d8 기록 줄 (0xa719c 모드 4 a71d0~a7222: [0] 타수 · [1] 안타 · [2] 타점 · [3] 홈런, u8) — 116 이 줄
   * "타수 안타 타점 홈런"(12958~12998)과 칭호 39 판정([3] > 3, 129b2)에 읽는다. 정규시즌 경기만 덮어쓴다. 옛 저장에는 없다
   */
  readonly recordLine?: NariRecordLine
}

/** 타자편 S+0x1d8 네 바이트 */
export interface NariRecordLine {
  readonly atBats: number
  readonly hits: number
  readonly runsBattedIn: number
  readonly homeRuns: number
}

/** 이 경기 성적으로 S+0x1d8 줄을 짓는다 (strb — u8) */
export function nariRecordLineOf(stats: Pick<GameSummary['stats'], 'atBats' | 'hits' | 'runsBattedIn' | 'homeRuns'>): NariRecordLine {
  return {
    atBats: stats.atBats & 0xff,
    hits: stats.hits & 0xff,
    runsBattedIn: stats.runsBattedIn & 0xff,
    homeRuns: stats.homeRuns & 0xff,
  }
}

/**
 * **116 기록 줄 글** — 진입 0x1278c 의 모드 4 갈래(12958~1299a, 직접 떴다): 글 상자(sp+0x4c, 0xbc75d)에 S+0x1d8 의 네 바이트를
 * 차례로 숫자(0xbc73d — ldrb 라 u8 그대로)와 글로 붙인다.
 * ```
 * [0] + "타수 "(0xcc938) · [1] + "안타 "(0xcc940) · [2] + "타점 "(0xcc948) · [3] + "홈런!N"(0xcc950)
 * ```
 * 이 글은 평가 내장 이벤트 0x8a6fc 의 넷째 인자로 이벤트 +0x2cc 에 담기고(0x8a76c), 이벤트 글을 짓는 0x8bab8 이 +0xb 가 서 있으면
 * **이 줄 뒤에 감독 글(StrUSER_EVT[+0x1e])을 이어 붙여** 한 대사로 띄운다(0x8bb66~0x8bbac). 끝의 `!N` 이 줄바꿈이라 감독 글이 다음 줄이다.
 * 포스트시즌 경기 뒤에는 S+0x1d8 이 앞 평가 경기 값이다(`NariLastGame.recordLine`, a2ad0a7).
 */
export function nariRecordLineTextOf(line: NariRecordLine): string {
  return `${line.atBats}타수 ${line.hits}안타 ${line.runsBattedIn}타점 ${line.homeRuns}홈런!N`
}

/** 116 이 읽는 S+0x1d8 — 저장의 줄, 줄이 없던 옛 저장이면 그 경기 성적으로 */
export function nariLastGameRecordLineOf(lastGame: NariLastGame): NariRecordLine {
  return lastGame.recordLine ?? nariRecordLineOf(lastGame.summary.stats)
}

/** 경기 요약에서 116 재료만 — 리그 선수 기록·투수 줄·스태미나 표는 정산이 이미 먹었다 */
export function nariLastGameOf(
  summary: GameSummary,
  evaluation: GameEvaluation,
  recordLine: NariRecordLine = nariRecordLineOf(summary.stats),
): NariLastGame {
  return {
    recordLine,
    summary: {
      result: summary.result,
      ourScore: summary.ourScore,
      opponentScore: summary.opponentScore,
      stats: summary.stats,
      popularityPoints: summary.popularityPoints,
      doublePlays: summary.doublePlays,
      scoringPositionOuts: summary.scoringPositionOuts,
      reputationCounts: summary.reputationCounts,
      ourTeamId: summary.ourTeamId,
      opponentTeamId: summary.opponentTeamId,
      recordIds: summary.recordIds,
      ...(summary.pitchersOfRecord === undefined ? {} : { pitchersOfRecord: summary.pitchersOfRecord }),
    },
    evaluation,
  }
}
