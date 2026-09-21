import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { startNextPitcherSeason } from '@/entities/pitcher-career/model/pitcherCareer'

/**
 * 나만의리그 **투수편**(모드 3) 한 해의 끝 — 시즌 끝 → 연말(상태 132) → 엔딩(상태 141).
 *
 * 타자편 `entities/career/model/seasonFlow.ts` 와 **같은 규칙**이다. 판정 `0xa3a84` 도
 * 연말 분기 `0x10c54` 도 인기도·평판·소지금·연차만 보고 **모드(3·4)로 갈리지 않는다**
 * (B-season-awards.md B-6 "판정 0xa3a84(career) → StrENDING 번호" · 6절 "연말 분기(상태 132)").
 * 그래서 값만 `PitcherCareer` 에서 읽도록 옮겨 적었다 — 타자편 함수는 `PlayerCareer` 를 받아
 * 그대로 부를 수가 없다.
 *
 * **투수편이 타자편과 다른 곳**(그래서 여기 없는 것):
 *   - 올해의 목표(392·393~396)는 투수 표 `0xd7e9a` 를 쓰고 마무리면 `+0x82` 뒤 표다
 *     (B 7절 · B-9). 그 표가 `shared/config/original/yearGoals.ts` 에 **아직 안 뽑혀 있어**
 *     (생성기가 타자 표 0xd7f9e 만 읽는다) 달성 수를 셀 수 없다 → 목표 평가 단계를 넣지 않았다.
 *   - 개인 타이틀(130)·MVP(131)는 투수 종류 다승(마무리면 세이브)·탈삼진·방어율로 갈리는데
 *     (`awards/seasonAwards.ts` 의 `AwardRole` 이 이미 안다), 리그 선수 기록표
 *     `entities/league/model/leaguePlayerStats.ts` 가 **타자 네 칸만 쌓는다**(그 파일이 스스로
 *     "투수 칸은 쌓지 않는다" 고 적어 두었다) → CPU 투수에게 승·탈삼진·자책점이 없어 1위를
 *     가릴 수가 없다. 지어내지 않고 빼 둔다.
 *   - 연봉협상(380~391)도 등급 k 가 위 타이틀 1위 수라 같은 까닭으로 빠진다.
 *     연봉만큼의 소지금은 `startNextPitcherSeason`(0x1b768)이 이미 얹는다.
 */

/** 부상 상태로 이만큼 경기에 나가면 부상 엔딩 (0xa3a84 첫 줄 `+0x1b6 > 19`, B-7) */
const INJURED_GAMES_FOR_ENDING = 20
/** 엔딩 판정이 처음 열리는 연차 */
const FIRST_ENDING_YEAR = 7
/** 13년차는 은퇴식(504)으로 반드시 끝난다 */
const FINAL_YEAR = 13
/** 스킬 7 "전설" (0xa3a84 의 `+0x1b8` 비트7) */
const LEGEND_SKILL = 7
/** 원본 소지금 판정 단위(100만원) — 웹판 소지금은 만원 단위다 */
const MONEY_UNIT = 100

/** StrENDING 번호 — 0 부상 · 1 방출 · 2 은퇴식 */
export const PITCHER_INJURY_ENDING = 0
export const PITCHER_RELEASE_ENDING = 1
export const PITCHER_RETIREMENT_ENDING = 2

/**
 * 엔딩 판정 `0xa3a84` → StrENDING 번호 (null = 판정 없음).
 * 타자편 `judgeEnding` 과 **글자 그대로 같은 식**이다 (B-6).
 */
export function judgePitcherEnding(career: PitcherCareer): number | null {
  const year = career.season
  const popularity = career.popularity
  const reputation = career.reputation
  const money = Math.trunc(career.money / MONEY_UNIT)
  // 첫 줄은 연차보다 먼저 본다 — 어느 해든 20번째 부상 출전에서 끝난다 (B-7)
  if (career.injuredGamesPlayed >= INJURED_GAMES_FOR_ENDING) return PITCHER_INJURY_ENDING
  if (year < FIRST_ENDING_YEAR) return null
  if (year === FIRST_ENDING_YEAR && popularity <= 499) return PITCHER_RELEASE_ENDING
  if (year >= FINAL_YEAR) {
    if (popularity > 3500 && career.skillIds.includes(LEGEND_SKILL)) return 9
    if (popularity > 3000 && reputation > 699 && money > 399) return 8
    if (popularity > 2500 && reputation > 499) return 7
    if (popularity > 2000 && reputation > 299) return 6
  }
  if (popularity > 1500) return 5
  if (popularity > 1000 && money > 199) return 4
  if (popularity > 1000) return 3
  // ⚠️ **원본 그대로**: "999 이하" 만 은퇴식이라 인기도가 정확히 1000 이면 판정이 없다 (−1)
  return popularity <= 999 ? PITCHER_RETIREMENT_ENDING : null
}

/**
 * 경기 뒤 관리 화면 진입(상태 105, `0x11910` → `0x11b32`)이 보는 부상 엔딩 검사.
 * `0xa3a84 == 0` 이면 이벤트 500 을 거쳐 엔딩 화면 141 로 간다 (B-7).
 */
export function pitcherInjuryEndingOf(career: PitcherCareer): number | null {
  return judgePitcherEnding(career) === PITCHER_INJURY_ENDING ? PITCHER_INJURY_ENDING : null
}

/** 연말(상태 132, `0x10c54`)이 고르는 다음 걸음 */
export type PitcherYearEndStep =
  /** 방출 501 · 은퇴식 504 — 곧바로 엔딩 화면 141 */
  | { readonly kind: '엔딩'; readonly endingIndex: number }
  /** 은퇴 선택 502 (7~12년차) — 계속할지 그만둘지 선수가 고른다 */
  | { readonly kind: '은퇴선택' }
  /** 연봉협상 380 자리 — 새 시즌 처리 0x1b768 로 간다 */
  | { readonly kind: '새시즌' }

/**
 * 연말 분기 `0x10c54` (B 6절 "연말 분기(상태 132)").
 *   판정 == 1 → 501 방출 / 연차idx == 12(13년차) → 504 은퇴식 / idx > 5(7~12년차) → 502 은퇴 선택 /
 *   그 밖(1~6년차) → 380 연봉협상
 * 8~12년차는 인기도가 낮아도 방출되지 않는다 — 방출 검사는 7년차에서만 한다.
 */
export function pitcherYearEndStepOf(career: PitcherCareer): PitcherYearEndStep {
  const judged = judgePitcherEnding(career)
  if (judged === PITCHER_RELEASE_ENDING) return { kind: '엔딩', endingIndex: PITCHER_RELEASE_ENDING }
  if (career.season >= FINAL_YEAR) return { kind: '엔딩', endingIndex: judged ?? PITCHER_RETIREMENT_ENDING }
  if (career.season >= FIRST_ENDING_YEAR) return { kind: '은퇴선택' }
  return { kind: '새시즌' }
}

/**
 * 은퇴 선택 502 에서 "은퇴" 를 고른 뒤 (496 → 503 → 엔딩).
 * 타자편 `seasonEvents.nextSeasonStep` 과 같이 판정값이 없으면 은퇴식 엔딩 2 로 본다.
 */
export function pitcherRetirementEndingOf(career: PitcherCareer): number {
  return judgePitcherEnding(career) ?? PITCHER_RETIREMENT_ENDING
}

/** 엔딩 보너스 표 0xcc40c (단위 1000 G포인트) — 타자편과 같은 표다 */
const ENDING_BONUS_THOUSANDS: readonly number[] = [0, 0, 4, 8, 10, 12, 14, 16, 18, 20]
const GAME_POINT_THOUSAND = 1000
/** 부상(0)·방출(1)은 보너스 대신 이어하기를 묻는다 — StrMODE[221] */
const CONTINUABLE_ENDING_LIMIT = 1
export const PITCHER_CONTINUE_COST_GAME_POINT = 5000
const MAXIMUM_GAME_POINT = 99_999

export function pitcherEndingBonusOf(endingIndex: number): number {
  return (ENDING_BONUS_THOUSANDS[endingIndex] ?? 0) * GAME_POINT_THOUSAND
}

export function applyPitcherEndingBonus(career: PitcherCareer, endingIndex: number): PitcherCareer {
  return {
    ...career,
    gamePoint: Math.min(MAXIMUM_GAME_POINT, career.gamePoint + pitcherEndingBonusOf(endingIndex)),
  }
}

export function isContinuablePitcherEnding(endingIndex: number): boolean {
  return endingIndex <= CONTINUABLE_ENDING_LIMIT
}

export function canContinueAfterPitcherEnding(career: PitcherCareer, endingIndex: number): boolean {
  return isContinuablePitcherEnding(endingIndex) && career.gamePoint >= PITCHER_CONTINUE_COST_GAME_POINT
}

/**
 * "현재 상태에서 이어하기" (141 틀 0x1bbc4 의 팝업 0x32 · 0x1bd36).
 * 5000 G포인트를 쓰고 **부상 엔딩이면 부상만 풀어 같은 시즌 관리 화면(105)** 으로,
 * 그 밖이면 새 시즌 처리(0x1b768) 뒤 137 → 105 로 간다.
 */
export function continueAfterPitcherEnding(career: PitcherCareer): PitcherCareer {
  const paid: PitcherCareer = {
    ...career,
    gamePoint: career.gamePoint - PITCHER_CONTINUE_COST_GAME_POINT,
    endingIndex: null,
  }
  if (career.endingIndex === PITCHER_INJURY_ENDING) {
    return { ...paid, isInjured: false, injuredGamesPlayed: 0, injuryRemaining: 0 }
  }
  return startNextPitcherSeason(paid)
}
