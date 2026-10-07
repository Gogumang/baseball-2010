import { battingAverageOf, earnedRunAverageOf } from '@/entities/awards/model/leaderboard'
import type { LeagueRecord } from '@/entities/awards/model/leaderboard'

/**
 * **시즌정보 → 기록순위** — 팝업 0x80(타자기록/투수기록) 뒤 상태 **0xdb** 의 리그 개인 순위표 (직접 떴다).
 *
 * ```
 * 0x56fc (0xdb 들어옴)  0x5761c(목록, 만들기 0, 투수? = (this+0x16c == 0), 내 팀, SR+0xb3) · 0x5570c(…)
 *   0x5761c 만들기 0 갈래  순위 객체 0x9d77c 를 새로 만들고 ed+0x444 = 0(쪽)
 *                          타자: 0x9d789(객체, 12, [0x1552d10], 1, 0) · ed+0x445 = 4(마지막 쪽)
 *                          투수: 0x9d789(객체,  4, [0x1552d10], 1, 0) · ed+0x445 = 5
 * 0x74c4 (키)           취소(−16) → 0xcd · 그 밖 0x5787c(목록, 키)
 *   0x5787c              오른쪽(−4)·'6' : 쪽 ≠ 마지막이면 +1 · 왼쪽(−3)·'4' : 쪽 ≠ 0 이면 −1 (감기지 않는다)
 *                        쪽이 바뀌면 0x9d789(객체, 종류표[쪽], [0x1552d10], 1, 0) 로 다시 뽑는다
 *                        종류표 타자 0xd1a4c [12, 8, 9, 10, 11] · 투수 0xd1a60 [4, 1, 2, 3, 5, 6]
 * 0xafa8 (그림)         0x5796c(목록) · 머리띠 0x7f4ec
 * ```
 *
 * **순위 객체 0x9d789(객체, 종류, 모드, 큰쪽?, 고정문턱?)** — 시상(`entities/awards/model/leaderboard.ts`)과 같은 함수다.
 * 여기서는 다섯째 인자가 **0** 이라 규정 문턱이 104 · 45 가 아니라 **이번 시즌 경기 수 g = SR+0xb2** 로 정해진다
 * (0x9d7f6~0x9d826, 모드 2): 규정 타수 = trunc((g × 23 + 9) / 10) · 규정 이닝 = g (아웃 / 3 ≥ g).
 * 종류별 값(점프표 0xd7398):
 * ```
 * 1 승 +0x2e · 2 패 +0x2f · 3 세이브 +0x24 · 4 방어율 0xb6ce8(오름차순, 규정 이닝) · 5 실점 +0x22 · 6 탈삼진 +0x26
 * 8 안타 +0x22 · 9 홈런 +0x28 · 10 도루 +0x2c · 11 타점 +0x2a · 12 타율 0xb8e3c(규정 타수)
 * ```
 * 열 팀 × 레코드 차례로 훑어 +0x20 ≤ 0 이거나 0xb633c 인 줄을 빼고, 10칸 표에 "기존 칸보다 엄격히 나을 때만" 끼운다 —
 * 같은 값이면 먼저 들어온 쪽이 앞이다.
 * 머리 글 img_text(0x56dd4): 타자 [172 타율 · 208 안타 · 61 홈런 · 211 도루 · 62 타점] ·
 * 투수 [171 방어 · 215 승 · 216 패 · 217 세이브 · 214 실점 · 181 삼진].
 */

export type SeasonRankingSide = '타자' | '투수'

export interface SeasonRankingCategory {
  /** 0x9d789 의 종류 번호 */
  readonly kind: number
  /** 머리 글 img_text 프레임 (0x56dd4) */
  readonly labelFrame: number
  readonly label: string
}

/** 종류표 0xd1a4c · 머리 글 비트표 0xd1a78 → 0x56dd4 */
export const BATTER_RANKING_CATEGORIES: readonly SeasonRankingCategory[] = [
  { kind: 12, labelFrame: 172, label: '타율' },
  { kind: 8, labelFrame: 208, label: '안타' },
  { kind: 9, labelFrame: 61, label: '홈런' },
  { kind: 10, labelFrame: 211, label: '도루' },
  { kind: 11, labelFrame: 62, label: '타점' },
]
/** 종류표 0xd1a60 · 머리 글 비트표 0xd1a8c → 0x56dd4 */
export const PITCHER_RANKING_CATEGORIES: readonly SeasonRankingCategory[] = [
  { kind: 4, labelFrame: 171, label: '방어율' },
  { kind: 1, labelFrame: 215, label: '승' },
  { kind: 2, labelFrame: 216, label: '패' },
  { kind: 3, labelFrame: 217, label: '세이브' },
  { kind: 5, labelFrame: 214, label: '실점' },
  { kind: 6, labelFrame: 181, label: '삼진' },
]

export function rankingCategoriesOf(side: SeasonRankingSide): readonly SeasonRankingCategory[] {
  return side === '타자' ? BATTER_RANKING_CATEGORIES : PITCHER_RANKING_CATEGORIES
}

/** 0x5787c — 좌·우로 쪽을 옮긴다. 끝에서 멈춘다 */
export function moveRankingPage(side: SeasonRankingSide, page: number, step: -1 | 1): number {
  const last = rankingCategoriesOf(side).length - 1
  if (step > 0) return page === last ? page : page + 1
  return page === 0 ? page : page - 1
}

/** 순위표 칸 수 */
export const SEASON_RANKING_SIZE = 10
const AT_BATS_PER_GAME_TENTHS = 23
const OUTS_PER_INNING = 3

/** 규정 문턱 (0x9d7f6~0x9d826) — g = SR+0xb2 */
export function seasonQualificationOf(games: number): { readonly atBats: number; readonly innings: number } {
  return { atBats: Math.trunc((games * AT_BATS_PER_GAME_TENTHS + 9) / 10), innings: games }
}

/** 0x9d789 의 값 — null 이면 이 종류에 못 낀다 */
export function seasonRankingValueOf(record: LeagueRecord, kind: number, games: number): number | null {
  if (record.isOutOfRanking || record.atBatsOrOuts <= 0) return null
  const qualified = seasonQualificationOf(games)
  switch (kind) {
    case 1: return record.wins
    case 2: return record.losses
    case 3: return record.saves
    case 4:
      return Math.trunc(record.atBatsOrOuts / OUTS_PER_INNING) >= qualified.innings ? earnedRunAverageOf(record) : null
    case 5: return record.hits // 투수 +0x22 실점
    case 6: return record.strikeouts
    case 8: return record.hits
    case 9: return record.homeRuns
    case 10: return record.batterExtra
    case 11: return record.runsBattedIn
    case 12: return record.atBatsOrOuts >= qualified.atBats ? battingAverageOf(record) : null
    default: return null
  }
}

export interface SeasonRankingEntry {
  readonly record: LeagueRecord
  readonly value: number
}

/**
 * 상위 10명 — 0x9d93e~0x9d9b8: 칸 0 부터 훑어 빈 칸(−1)이거나 새 값이 엄격히 나으면 그 자리에 끼우고 뒤를 민다.
 * 큰 쪽이 좋다(셋째 인자 1) — 방어율(종류 4)만 작은 쪽.
 * ⚠️ 원본 그대로: 빈 칸 표시가 값 −1 이라 값이 음수인 줄은 없다(성적은 0 이상).
 */
export function rankSeasonRecords(records: readonly LeagueRecord[], kind: number, games: number): readonly SeasonRankingEntry[] {
  const ascending = kind === 4
  const leaders: SeasonRankingEntry[] = []
  for (const record of records) {
    const value = seasonRankingValueOf(record, kind, games)
    if (value === null) continue
    const slot = leaders.findIndex((entry) => (ascending ? value < entry.value : value > entry.value))
    if (slot < 0) {
      if (leaders.length < SEASON_RANKING_SIZE) leaders.push({ record, value })
      continue
    }
    leaders.splice(slot, 0, { record, value })
    if (leaders.length > SEASON_RANKING_SIZE) leaders.pop()
  }
  return leaders
}

/**
 * 숫자 찍기 0x6aff8 의 소수 갈래 (넷째 바이트 인자 1) — 0x6b04a~0x6b19e.
 * ```
 * v > 99999 → 나눔 1000 · 점 자리 3 / v > 9999 → 100 · 2 / v > 999 → 10 · 1
 * 그 밖     → 자릿수 0 이면 자릿수 3 · 점 자리 0, 자릿수 3 이면 점 자리 1
 * 오른쪽부터 자릿수만큼 (v mod 나눔×10) / 나눔 을 찍고(나눔 ×10), 셈 2·1·0 이 점 자리와 같은 자리의 왼쪽에 점
 * ```
 * 순위표는 타율을 (v > 999 ? 3 : 0) 자리로, 방어율을 (v > 100 ? v × 10 : v) 를 3 자리로 넘긴다(0x57fae · 0x57ffe).
 * 예: 타율 315 → ".315" · 1000 → "1.00" · 방어율 345 → "3.45" · 50 → "0.50" · 1234 → "12.3".
 */
export function originalDecimalTextOf(value: number, digitsArgument: number): string {
  let divisor = 1
  let digits = digitsArgument
  let dotAt = 0
  if (value > 99999) {
    divisor = 1000
    dotAt = 3
  } else if (value > 9999) {
    divisor = 100
    dotAt = 2
  } else if (value > 999) {
    divisor = 10
    dotAt = 1
  } else if (digits === 0) {
    digits = 3
  } else if (digits === 3) {
    dotAt = 1
  }
  let text = ''
  let count = 2
  for (let index = 0; index < digits; index += 1) {
    text = String(Math.trunc((value % (divisor * 10)) / divisor)) + text
    if (count === dotAt) text = `.${text}`
    count -= 1
    divisor *= 10
  }
  return text
}

/** 순위표 값 글 (0x57fa8~0x580ca) */
export function seasonRankingValueTextOf(kind: number, value: number): string {
  if (kind === 12) return originalDecimalTextOf(value, value > 999 ? 3 : 0)
  if (kind === 4) return originalDecimalTextOf(value > 100 ? value * 10 : value, 3)
  return String(value)
}
