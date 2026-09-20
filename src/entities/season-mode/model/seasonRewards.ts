import {
  MONEY_LIMIT,
  POPULARITY_LIMIT,
  REPUTATION_LIMIT,
  clampTo,
} from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'

/**
 * 시즌 결산 보상 — 한국시리즈(`0x85ec`) · 국가대항전(`0x896c`) · 리그 1위 G포인트(`0x6900`).
 * 근거: `docs/re/P4-season-flow.md` 4b 절 (확정).
 */

export interface SeasonReward {
  readonly popularity: number
  readonly reputation: number
  /** 100만 원 단위 */
  readonly money: number
  /** G포인트 */
  readonly gamePoint: number
  /** 안내 문구 번호 (StrMODE) */
  readonly messageId: number
}

const NOTHING: SeasonReward = { popularity: 0, reputation: 0, money: 0, gamePoint: 0, messageId: 0 }

/**
 * 한국시리즈 결과 보상 — 내 팀의 포스트시즌 순위(`0xb7aa0(리그, 팀, 0)`)로 고른다.
 * 우승 StrMODE[197] · 준우승 StrMODE[198], 3위 아래는 없다.
 */
export function koreanSeriesRewardOf(postseasonRank: number): SeasonReward {
  if (postseasonRank === 0) {
    return { popularity: 25, reputation: 30, money: 40, gamePoint: 0, messageId: 197 }
  }
  if (postseasonRank === 1) {
    return { popularity: 15, reputation: 15, money: 15, gamePoint: 0, messageId: 198 }
  }
  return NOTHING
}

/** 국가대항전에서 대한민국의 팀 번호 */
export const KOREA_TEAM_ID = 10

/**
 * 국가대항전 결과 보상 (`0x896c`, 팝업 1 닫힘).
 *
 * ⚠️ **원본 버그 그대로**: 준우승 문구 StrMODE[200] 은 "소지금 +2500만" 이라 적혀 있는데
 * 실제로 더하는 값은 **+20 (= 2000만)** 이다 (`0x8a2e` 표시 vs `0x8b76 adds #0x14`).
 * 표시와 실제가 다른 채로 둔다.
 */
export const NATIONAL_CUP_RUNNER_UP_TEXT_MONEY = 25
export function nationalCupRewardOf(champion: number, koreaInFinal: boolean): SeasonReward {
  if (champion === KOREA_TEAM_ID) {
    return { popularity: 30, reputation: 40, money: 50, gamePoint: 1000, messageId: 199 }
  }
  if (koreaInFinal) {
    // 문구는 2500만이지만 코드는 20(=2000만)을 더한다 — 원본 그대로
    return { popularity: 20, reputation: 20, money: 20, gamePoint: 0, messageId: 200 }
  }
  return NOTHING
}

/** 보상을 레코드에 적용한다 (인기도 9999 · 평판 999 · 소지금 9999 상한) */
export function applySeasonReward(record: SeasonRecord, reward: SeasonReward): SeasonRecord {
  return {
    ...record,
    popularity: clampTo(record.popularity + reward.popularity, POPULARITY_LIMIT),
    reputation: clampTo(record.reputation + reward.reputation, REPUTATION_LIMIT),
    money: clampTo(record.money + reward.money, MONEY_LIMIT),
  }
}

/** 리그 1위 누적 문턱 `0xcbdec` (s8) */
export const LEAGUE_FIRST_THRESHOLDS: readonly number[] = [3, 10, 20]
/** 그때 주는 G `0xcbdef` (s8) — 실제 지급은 ×1000 이다 */
export const LEAGUE_FIRST_GAME_POINTS: readonly number[] = [1, 5, 10]
/** G포인트 상한 (저장+0x64) */
export const GAME_POINT_LIMIT = 99_999

export interface LeagueFirstAward {
  /** 문턱 (문구 StrMODE[223] 의 첫 %d) */
  readonly threshold: number
  /** 실제로 더하는 G */
  readonly gamePoint: number
  /** 저장(전역) +0x145 에서 켜야 할 비트 번호 = 업적 칸 번호 */
  readonly bit: number
}

/**
 * 리그 1위 G 지급 검사 (`0x6900` 갱신 + `0x87e8` 팝업 닫힘).
 * ```
 * k = SR+0x7a (정규시즌 1위 횟수)
 * for i in 0..2: k ≥ 문턱[i] 이고 저장+0x145 의 비트 i 가 0 이면 → 지급하고 이번 호출은 끝
 * ```
 * 한 번에 하나만 준다 — 팝업이 닫히면 다음 문턱을 다시 본다. 비트가 **전역 저장**에 있어
 * 시즌을 새로 시작해도 다시 받지 못한다(의도로 보임).
 */
export function nextLeagueFirstAward(record: SeasonRecord, awardedBits: number): LeagueFirstAward | null {
  for (let i = 0; i < LEAGUE_FIRST_THRESHOLDS.length; i += 1) {
    if (record.regularSeasonFirsts >= LEAGUE_FIRST_THRESHOLDS[i] && (awardedBits & (1 << i)) === 0) {
      return {
        threshold: LEAGUE_FIRST_THRESHOLDS[i],
        gamePoint: LEAGUE_FIRST_GAME_POINTS[i] * 1000,
        bit: i,
      }
    }
  }
  return null
}

/** 10년차 엔딩 보너스 표 `0xcbc2e` (s8) × 1000 G — StrMODE[214] (J 4-8) */
export const ENDING_BONUS_GAME_POINTS: readonly number[] = [0, 3, 6, 9, 12]

/**
 * 10년차 엔딩 판정 `0xa3084` (J 4-8). 연차 idx 가 9 가 아니면 엔딩이 아니다(null).
 * `k` 는 **정규시즌 1위 횟수**(SR+0x7a)이고 한국시리즈 우승 수가 아니다 (P4 7절 정정).
 */
export function judgeSeasonEnding(record: SeasonRecord): number | null {
  if (record.yearIndex !== 9) return null
  const k = record.regularSeasonFirsts
  const popularity = record.popularity
  if (popularity > 2000 && k === 10) return 4 // 역사상 최고의 구단
  if (popularity > 1500 && k > 6) return 3 // 세계 일류 구단
  if (popularity > 1000 && k > 3) return 2 // 한국 최고 구단
  if (popularity > 800) return 1 // 지역 인기 구단
  return 0 // 비 인기 구단
}
