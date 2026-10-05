import { rankingOf } from '@/entities/league/model/league'
import type { League, PostseasonSeries } from '@/entities/league/model/league'
import { runCpuPostseason } from '@/entities/league/model/postseasonPlay'
import { isMyTurn } from '@/entities/league/model/seasonEnd'
import { BALANCE } from '@/shared/config/original/balance'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 나만의리그 **포스트시즌 대진 화면 128** (장면 0x106) — 타자편(모드 4)·투수편(모드 3) 공용.
 *
 * 장면 0x106 은 두 편이 함께 쓰고, 128 의 진입·키·틀 세 함수에는 모드 갈림이 **보상 해금 id 하나**뿐이다.
 * 그래서 여기 함수들은 두 커리어(`PlayerCareer` · `PitcherCareer`)에 다 있는 칸만 보는 구조 타입으로 받는다.
 *
 * ```
 * 128 진입 0x120a4:  이전 상태 1 이면 배경음 4 · S+0x50 = 0xf · 저장 · 판 0x76705(0x23,0xbe,0x1e) · 0x8533d(대진 준비)
 *                    S+0x77 == 0 && 0xb7aa1(L, 내 팀, 1) == 0  → StrMODE[191] 팝업 0xb (OK 하나)
 * 128 키 0x13da0 (확인 −5/0x35, 팝업이 없을 때만 — 0x1d06a 의 0x754f9 검사):
 *     L+0x36(끝남) ≠ 0 → StrMODE[137] "한국시리즈 우승!! [팀]"(팀 이름 표 0x1552cf8[L+0x37]) 팝업 7
 *     그 밖 고리 13e16: 지금 라운드 대진(0xb7649 칸 1·0)에 내 팀이 있으면 — 이번 키에 CPU 경기를 안 돌렸을 때만 → 142
 *                       없으면 그 라운드가 끝날 때까지 0xc2761 (CPU 한 경기) · 저장 · L+0x36 == 0 이면 고리 처음으로
 *                       (CPU 를 한 번이라도 돌렸으면 내 차례가 와도 **128 에 머문다** — 다음 키에 142)
 * 128 틀 0x15984 (팝업 닫힘, 답 0 또는 0x14):
 *     팝업 7: L+0x37 == 내 팀 → StrMODE[190] 팝업 8 · 아니면 → 132(연말)
 *     팝업 8: 인기도 +15(≤9999) · 평판 +25(≤999) · 소지금 +10(100만 칸, ≤9999) · 저장 → 132
 *     팝업 0xb: 인기도 +10 · 소지금 +5 · S+0x77 = 1 · 저장 · 해금(아래) — 128 에 머문다
 * 그리기 0x168e8 → 0x853ac (대진표)
 * ```
 * 들어오는 곳은 131(MVP 뒤) · 경기 뒤 100 → 116 → 114 → 128 · 142 취소다 (R9 128절).
 *
 * 내 경기는 **정규시즌과 같은 경기 흐름**(142 → 144 → 경기 장면)이고, 결과는 `applyGameResult` 의
 * 포스트시즌 갈래(0xb76dc)가 시리즈 승수로 넣는다. 경기 뒤 평가 0xa719c 는 포스트시즌에 돌지 않는다
 * (0x4f268 — `isEvaluatedGame`).
 */

/** 128 이 보는 커리어 칸 — 타자편·투수편 커리어 둘 다 이 모양을 갖는다 */
export interface PostseasonCareerFields {
  readonly teamId: number
  readonly popularity: number
  readonly reputation: number
  /** 웹 소지금(만원) — 원본 S+2 는 100만 칸 */
  readonly money: number
  readonly league: League
  readonly postseason: PostseasonSeries | null
  /** 정규시즌 1위 횟수 S+0x7a (0xb818c 가 45경기째 하루 끝에 늘린다) */
  readonly regularSeasonFirstCount: number
  /** 정규시즌 우승 보상을 받았는가 S+0x77 (새 시즌 0x1b7c0 이 지운다) */
  readonly regularSeasonRewardTaken: boolean
  readonly openedHiddenIds: readonly number[]
}

/** 128 위에 뜨는 팝업 (0xbbef9 의 코드) — 셋 다 OK 하나짜리 알림이다 */
export type PostseasonPopup =
  /** 0xb — StrMODE[191] 정규시즌 우승 */
  | { readonly kind: '정규시즌우승' }
  /** 7 — StrMODE[137] 한국시리즈 우승 팀 발표 */
  | { readonly kind: '우승발표'; readonly champion: number }
  /** 8 — StrMODE[190] 내 팀 한국시리즈 우승 */
  | { readonly kind: '한국시리즈우승' }

export const POSTSEASON_TEXT_ID = {
  정규시즌우승: 191,
  우승발표: 137,
  한국시리즈우승: 190,
} as const

/** 팝업 0xb 보상 (0x15b0e~0x15b4c) — 인기도 +10 · 소지금 +5(×100만) */
export const REGULAR_SEASON_REWARD = { popularity: 10, moneyUnits: 5 } as const
/** 팝업 8 보상 (0x15a40~0x15a94) — 인기도 +15 · 평판 +25 · 소지금 +10(×100만) */
export const KOREAN_SERIES_REWARD = { popularity: 15, reputation: 25, moneyUnits: 10 } as const

/**
 * 팝업 0xb 닫힘의 해금 — `S+0x7a > 4`(0x15c62 `cmp #4 ; ble`) 이면 `0x62369(g, 모드==4 ? 0x22 : 0x32, 0)`.
 * **타자편은 0x22(34), 투수편은 0x32(50)** 다. 34 는 투수 장비 칸(19~34), 50 은 타자 장비 칸(35~50)이라
 * 서로 **상대 편** 히든을 연다 — 원본 그대로 옮긴다.
 */
export const REGULAR_SEASON_HIDDEN_ID = { 타자편: 0x22, 투수편: 0x32 } as const
const REGULAR_SEASON_HIDDEN_COUNT_ABOVE = 4

const ORIGINAL_MONEY_UNIT: number = BALANCE.money.unit
const MAXIMUM_MONEY = BALANCE.limits.moneyUnits * ORIGINAL_MONEY_UNIT
const MAXIMUM_POPULARITY: number = BALANCE.limits.popularity
const MAXIMUM_REPUTATION: number = BALANCE.limits.reputation

/**
 * 128 진입 0x120a4 — 정규시즌 우승 팝업(0xb)을 띄우는가.
 * `0xb7aa1(L, 내 팀, 1)` 은 셋째 인자가 0 이 아니면 포스트시즌 중이라도 **정규시즌 순위**(0xb79d8)에서
 * 내 팀 자리를 돌려준다 — 0 이면 1위다. 포스트시즌 경기는 리그 전적을 안 건드리므로 45경기째 순위와 같다.
 */
export function regularSeasonPopupOnEnter(career: PostseasonCareerFields): PostseasonPopup | null {
  if (career.regularSeasonRewardTaken) return null
  return rankingOf(career.league)[0] === career.teamId ? { kind: '정규시즌우승' } : null
}

/** 128 키 0x13da0 한 번의 결과 */
export type PostseasonKeyResult =
  /** 포스트시즌이 끝났다 — 팝업 7 */
  | { readonly kind: '우승발표'; readonly champion: number }
  /** 지금 시리즈에 내 팀이 있고 이번 키에 CPU 경기를 안 돌렸다 — 142(경기 준비) */
  | { readonly kind: '내경기' }
  /** CPU 끼리 돌렸다 — 바뀐 대진을 들고 128 에 머문다 */
  | { readonly kind: 'CPU진행'; readonly series: PostseasonSeries }

/**
 * 128 [확인] (0x13da0). CPU 고리는 `runCpuPostseason`(0xc2760 · 내 차례나 끝날 때까지)과 같다 —
 * 원본 고리도 라운드 하나를 끝낼 때마다 내 팀이 있는지·끝났는지를 다시 보므로 멈추는 자리가 같다.
 */
export function pressPostseasonBracket(
  series: PostseasonSeries,
  myTeamId: number,
  random: RandomPort,
): PostseasonKeyResult {
  if (series.round === '종료') return { kind: '우승발표', champion: series.champion ?? -1 }
  if (isMyTurn(series, myTeamId)) return { kind: '내경기' }
  return { kind: 'CPU진행', series: runCpuPostseason(series, myTeamId, random) }
}

/** 팝업 7 닫힘 (0x159b8~0x159f4) — 우승 팀이 내 팀이면 팝업 8, 아니면 null(→ 132) */
export function popupAfterChampion(career: PostseasonCareerFields, champion: number): PostseasonPopup | null {
  return champion === career.teamId ? { kind: '한국시리즈우승' } : null
}

/**
 * 팝업 0xb 닫힘 (0x15aee~0x15c8a) — 정규시즌 우승 보상.
 * 소지금은 0x15b30 이 S+2 를 **바로** 쓴다(9999 칸 자름) — 인기도 S+0x48 도 증가 함수(0xa690c)를 안 거친다.
 *
 * ⚠️ 미해결: 0x15b84~0x15c52 의 **세 모드 해금 0x29** — `0x9f69d(app, 1, 1, 2)` 가 0 이면 저장 모드 3·4·2 를
 *    차례로 적재(0x213c1)해 셋 다 `+0x7a > 0` 일 때 `0x62369(g, 0x29, 0)` 을 부른다. 다른 모드의 저장을
 *    여기서 읽을 수 없어 옮기지 않았다. 그 뒤 0x15c54 의 자기 모드 해금(`REGULAR_SEASON_HIDDEN_ID`)만 옮긴다.
 * ⚠️ 해금 알림(0x62369 가 띄우는 글)은 웹에서 이 자리에 따로 띄우지 않는다 — id 만 남긴다.
 */
export function applyRegularSeasonReward<T extends PostseasonCareerFields>(career: T, hiddenId: number): T {
  const rewarded: T = {
    ...career,
    popularity: clamp(career.popularity + REGULAR_SEASON_REWARD.popularity, 0, MAXIMUM_POPULARITY),
    money: clamp(career.money + REGULAR_SEASON_REWARD.moneyUnits * ORIGINAL_MONEY_UNIT, 0, MAXIMUM_MONEY),
    regularSeasonRewardTaken: true,
  }
  if (career.regularSeasonFirstCount <= REGULAR_SEASON_HIDDEN_COUNT_ABOVE) return rewarded
  if (career.openedHiddenIds.includes(hiddenId)) return rewarded
  return { ...rewarded, openedHiddenIds: [...career.openedHiddenIds, hiddenId] }
}

/** 팝업 8 닫힘 (0x15a3a~0x15aa4) — 한국시리즈 우승 보상 */
export function applyKoreanSeriesReward<T extends PostseasonCareerFields>(career: T): T {
  return {
    ...career,
    popularity: clamp(career.popularity + KOREAN_SERIES_REWARD.popularity, 0, MAXIMUM_POPULARITY),
    reputation: clamp(career.reputation + KOREAN_SERIES_REWARD.reputation, 0, MAXIMUM_REPUTATION),
    money: clamp(career.money + KOREAN_SERIES_REWARD.moneyUnits * ORIGINAL_MONEY_UNIT, 0, MAXIMUM_MONEY),
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}
