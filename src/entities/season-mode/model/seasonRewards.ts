import {
  MONEY_LIMIT,
  MORALE_LIMIT,
  POPULARITY_LIMIT,
  REPUTATION_LIMIT,
  clampTo,
} from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord'
import type { BurstRewardDelta } from '@/entities/burst-mission/model/burstMissionReward'

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

/**
 * 시즌 돌발미션 보상·페널티 — `0x8e34c` 의 모드 2 갈래 (직접 떴다).
 *
 * ```
 * r6 = 0x1f55c(저장) = SR                       ; 8e376~8e37c (모드 2)
 * 종류 1 사기  : 0x1f9a8(저장, 2, SR[1]) = 0x1f570(저장, 팀) → 팀 레코드 +2 += v (0..100)   ; 8e3c8~8e404
 * 종류 2 인기도: SR+0x48 += v (0..9999)        ; 8e428~8e44a
 * 종류 3 평판  : SR+0x62 += v (0..999)         ; 8e44e~8e46c
 * 종류 4 소지금: SR+2 += v (0..9999, 100만 단위) ; 8e470~8e48a
 * ```
 * 성공은 두 칸을 더하고 실패는 한 칸을 뺀다 — 부호는 `burstRewardDeltasOf` 가 이미 먹였다.
 * 원본은 판정이 난 **그 자리(경기 중)** 에서 더하므로 경기 끝 평가(0x4ea0c)보다 앞이다.
 */
export function applySeasonBurstRewards(state: SeasonState, deltas: readonly BurstRewardDelta[]): SeasonState {
  return deltas.reduce<SeasonState>((current, delta) => {
    const { record } = current
    switch (delta.name) {
      case '사기':
        return { ...current, teamMorale: clampTo(current.teamMorale + delta.amount, MORALE_LIMIT) }
      case '인기도':
        return { ...current, record: { ...record, popularity: clampTo(record.popularity + delta.amount, POPULARITY_LIMIT) } }
      case '평판':
        return { ...current, record: { ...record, reputation: clampTo(record.reputation + delta.amount, REPUTATION_LIMIT) } }
      case '소지금':
        return { ...current, record: { ...record, money: clampTo(record.money + delta.amount, MONEY_LIMIT) } }
    }
  }, state)
}

/**
 * 리그 1위 누적 **문턱** `0xcbdef` (s8) = [1, 5, 10] — 1회·5회·10회 (0x69f6).
 *
 * ⚠️ 예전에는 문턱과 금액을 **통째로 바꿔** 적어 두었다(주소까지 서로 바뀌어 있었다).
 * P4 본문의 "3/10/20회 → 1000/5000/10000 G" 가 두 표를 바꿔 읽은 것이고,
 * Q2 5-1 이 정정했다 — **1회 3000 · 5회 10000 · 10회 20000 G** (CORRECTIONS 2절).
 * 뒤바뀐 값으로는 첫 보상에 1위 3회가 필요하고 셋째 칸(20회)은 시즌이 10년이라 영영 못 받는다.
 */
export const LEAGUE_FIRST_THRESHOLDS: readonly number[] = [1, 5, 10]
/** 그때 주는 **금액** `0xcbdec` (s8) = [3, 10, 20] — 실제 지급은 ×1000 이다 (0x69e8) */
export const LEAGUE_FIRST_GAME_POINTS: readonly number[] = [3, 10, 20]
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

/** 해금 0x29 = 히든 칸 (1, 1, 2) = StrITEM[20] "오토봇 배트" (R13 §11 · `postseasonFlow.AUTOBOT_BAT_HIDDEN_ID` 와 같은 값) */
export const SEASON_AUTOBOT_BAT_HIDDEN_ID = 0x29

/** `0x6900` 머리가 적재해 읽는 다른 두 모드 저장과 전역 해금표 */
export interface SeasonAutobotBatInput {
  /** 나리 **투수편** 저장(모드 3, `0x213c0(g,3,1)` → `0x1f8d4(g,3)`)의 +0x7a 정규시즌 1위 횟수 — 저장이 없으면 0 */
  readonly pitcherEditionFirsts: number
  /** 나리 **타자편** 저장(모드 4)의 +0x7a — 저장이 없으면 0 */
  readonly batterEditionFirsts: number
  /** 전역 해금표 `app+0xc0` 에 이미 열린 id (`0x9f69d(g, 1, 1, 2)` 가 보는 칸) */
  readonly globalOpenedHiddenIds: readonly number[]
}

const signedByteOf = (value: number) => ((value & 0xff) << 24) >> 24

/**
 * 시즌 결산 0xef 에 **들어갈 때마다**(`0x6900`) 리그 1위 G 검사 앞에 도는 세 모드 해금 0x29 (0x6944~0x69d2, 직접 떴다):
 * ```
 * 0x9f69d(전역, 1, 1, 2) ≠ 0 → 0x69d4 (G 검사로)
 * 0x213c1(g,3,1) ; [sp+4] = (s8)[0x1f8d5(g,3) + 0x7a] ; 0x1f24d(g,3)   ; 투수편
 * 0x213c1(g,4,1) ; r4    = (s8)[0x1f8d5(g,4) + 0x7a] ; 0x1f24d(g,4)   ; 타자편
 * r2 = (s8)[SR + 0x7a]                                                 ; 지금 시즌
 * r4 > 0 && [sp+4] > 0 && r2 > 0 → r0 = 0x62369(ui, 0x29, 0) ; r0 ≠ 0 → 0x6ac8 (함수 끝)
 * ```
 * `0x62368` 은 셋째 인자 0 이면 이미 열린 칸에 0 을 돌려주고, **새로 열었을 때만** 0 이 아닌 값을 준다 — 그래서 0x29 가
 * 새로 열린 그 결산 진입은 **리그 1위 G 검사(0x69d4~)를 통째로 건너뛴다** (원본 버그 그대로, `equipment.ts` 주석).
 * 참이면 이번 진입에서 0x29 를 연다.
 */
export function opensSeasonAutobotBat(record: SeasonRecord, input: SeasonAutobotBatInput): boolean {
  if (input.globalOpenedHiddenIds.includes(SEASON_AUTOBOT_BAT_HIDDEN_ID)) return false
  return (
    signedByteOf(input.batterEditionFirsts) > 0
    && signedByteOf(input.pitcherEditionFirsts) > 0
    && signedByteOf(record.regularSeasonFirsts) > 0
  )
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
