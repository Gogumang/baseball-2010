import { MONEY_LIMIT, clampTo } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { boardBonusOf, standCapacityOf } from '@/entities/season-mode/model/stadiumItems'

/**
 * 경기 관중 수와 수입 — 원본 `0xa34b8`(계산, 경기 장면 0x39fdc 가 부른다) ·
 * `0xa3644`(구내매점 가산) · `0xdea0`(상태 0xe9 표시).
 *
 * 근거: `docs/re/J-modes-rules.md` 4-7 절 + `docs/re/S3-stadium-items.md` 8 절(표 확정).
 * S3 이 "J 4-7 의 식이 그대로 맞다" 로 확인했다.
 */

/**
 * 직전 경기 인기도 평가 `SR+0x4a` → 관중 보정 (`0xcbbf6` 계열 구간표).
 *
 * ⚠️ J 4-7 은 이 칸을 "연승" 으로 읽었지만 **연승이 아니다** — 직전 경기 인기도 평가 d 다
 * (P4 7절 정정). 구간 ≤−7 … ≥10 이 d 의 범위 [−8, +12] 와 맞는다.
 */
export function lastGameBonusOf(lastPopularityChange: number): number {
  const d = lastPopularityChange
  if (d <= -7) return -150
  if (d <= -4) return -100
  if (d <= -2) return -50
  if (d <= 3) return 0
  if (d <= 5) return 50
  if (d <= 7) return 100
  if (d <= 9) return 150
  return 200
}

/** 표 `0xd7db8` 앞 10칸 — 내 순위(0부터) 보너스 */
export const MY_RANK_BONUS: readonly number[] = [120, 100, 80, 60, 40, 0, -10, -20, -30, -40]
/** 표 `0xd7db8` 뒤 10칸 — 상대 순위 보너스 */
export const OPPONENT_RANK_BONUS: readonly number[] = [100, 80, 60, 40, 20, 0, 0, -10, -20, -30]

/** 시즌 초반(경기 수 ≤ 9)에는 순위 대신 이 값을 더한다 */
export const EARLY_SEASON_BONUS = 100
/** 경기 수가 이 값 이하면 초반으로 본다 */
export const EARLY_SEASON_GAMES = 9
/** `0xb6748` 은 늘 1 을 돌려주므로 결국 언제나 +150 이다 */
export const ALWAYS_BONUS = 150

/** 관중 하한 (3000명) */
export const ATTENDANCE_FLOOR = 3000
/** 관중석·전광판과 무관한 기본 관중 */
export const ATTENDANCE_BASE = 4000
/** `max(p,1)/5 × 120` 의 두 수 */
const POPULARITY_DIVISOR = 5
const POPULARITY_FACTOR = 120

/** 구내매점이 남아 있으면 경기 수입 +2 (= 200만) */
export const STORE_INCOME_BONUS = 2
/** 구내매점을 사면 45경기 = 딱 한 시즌 (GP 아이템 칸 6, R13 10절) */
export const STORE_GAMES_ON_PURCHASE = 45
/** 구내매점 기간 만료 안내 = StrUSER_EVT[113] (SYS sub 5 → 0x8b1b8) */
export const STORE_EXPIRED_USER_EVENT = 113

export interface AttendanceInput {
  /** 내 팀의 리그 순위 (0부터) — `0xb7aa1` */
  readonly myRank: number
  /** 상대 팀의 리그 순위 (0부터) */
  readonly opponentRank: number
}

export interface AttendanceResult {
  readonly attendance: number
  /** 100만 원 단위, 0~9999 */
  readonly income: number
  /** SR+0x65 — 만원 판정 0·1·2 */
  readonly crowdLevel: number
}

/**
 * 관중 수·수입 계산 (0xa34b8).
 * ```
 * p  = 평판 + 직전경기보정
 * p += (경기수 ≤ 9) ? 100 : 내순위보너스 + 상대순위보너스
 * p += 150
 * 관중 = (max(p,1)/5) × 120 + 전광판×1000 + 4000
 * 관중 = min(관중, 관중석×1000) ; 관중 = max(관중, 3000)
 * 수입 = (관중/20)×15/1000  (+2 구내매점)
 * ```
 * 나눗셈은 모두 정수 나눗셈(버림)이다.
 */
export function attendanceOf(record: SeasonRecord, input: AttendanceInput): AttendanceResult {
  let p = record.reputation + lastGameBonusOf(record.lastPopularityChange)
  p +=
    record.games <= EARLY_SEASON_GAMES
      ? EARLY_SEASON_BONUS
      : (MY_RANK_BONUS[input.myRank] ?? 0) + (OPPONENT_RANK_BONUS[input.opponentRank] ?? 0)
  p += ALWAYS_BONUS

  const capacity = standCapacityOf(record)
  let attendance =
    Math.trunc(Math.max(p, 1) / POPULARITY_DIVISOR) * POPULARITY_FACTOR + boardBonusOf(record) + ATTENDANCE_BASE
  attendance = Math.min(attendance, capacity)
  attendance = Math.max(attendance, ATTENDANCE_FLOOR)

  const base = Math.trunc((Math.trunc(attendance / 20) * 15) / 1000)
  const income = clampTo(base + (record.storeGames > 0 ? STORE_INCOME_BONUS : 0), MONEY_LIMIT)

  // 만원 판정 SR+0x65 — 수용의 80% 이상이면 2, 35% 를 넘으면 1 (유력: 관중 그림 단계)
  const crowdLevel = attendance >= capacity * 0.8 ? 2 : attendance > capacity * 0.35 ? 1 : 0

  return { attendance, income, crowdLevel }
}

export interface IncomeSettlement {
  readonly record: SeasonRecord
  readonly attendance: number
  readonly income: number
  /** 이 경기로 구내매점 기간이 끝났는가 — 끝나면 StrUSER_EVT[113] 팝업이 붙는다 */
  readonly storeExpired: boolean
}

/**
 * 경기 뒤 관중·수입 정산 (상태 0xe9 = 0xdea0).
 * 수입을 소지금에 더하고(0~9999), 관중 수를 SR+0x1b0/+0x1b4 에 남긴다.
 *
 * 같은 화면이 부르는 `0x8a6fc` 안에서 **구내매점 카운터 SR+0x55 가 1 줄고**,
 * 0 이 되는 그 경기의 평가 이벤트 끝에 만료 안내가 붙는다 (R13 10절 확정).
 * 줄이는 것은 시즌모드(모드 2)일 때뿐이다.
 */
export function settleGameIncome(record: SeasonRecord, input: AttendanceInput): IncomeSettlement {
  const { attendance, income, crowdLevel } = attendanceOf(record, input)
  const storeGames = record.storeGames > 0 ? record.storeGames - 1 : record.storeGames
  return {
    record: {
      ...record,
      money: clampTo(record.money + income, MONEY_LIMIT),
      lastIncome: income,
      lastAttendance: attendance,
      crowdLevel,
      storeGames,
    },
    attendance,
    income,
    storeExpired: record.storeGames > 0 && storeGames === 0,
  }
}
