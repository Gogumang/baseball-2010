import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { startNextPitcherSeason } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { EMPTY_LEAGUE_RECORD } from '@/entities/awards/model/leaderboard'
import type { LeagueRecord } from '@/entities/awards/model/leaderboard'
import {
  judgeAwards,
  leaguePitcherRecordsOf,
  recordMvpSeason,
  salaryRankOf,
} from '@/entities/awards/model/seasonAwards'
import type { AwardRole, SeasonAwards } from '@/entities/awards/model/seasonAwards'

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
 *   - 개인 타이틀(130)·MVP(131)·연봉협상 등급 k 는 **이 파일 아래쪽에 붙었다**.
 *     리그 선수 기록표가 이제 투수 줄(아웃·실점·탈삼진·투구·승·패)도 쌓아서
 *     (`entities/league/model/leaguePlayerStats.ts`) 1위를 가릴 재료가 생겼다.
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

/* ── 개인 타이틀(130) · MVP(131) · 연봉협상 등급 k ──────────────────────────── */

/**
 * 투수편 시상 — 원본은 타자편과 **같은 함수**(0x8dad4 타이틀 · 0x8dd60 MVP · 0xa4d78 등급 k)를
 * 종류 표만 바꿔 부른다. 투수 종류 표 0xd4f24 = `[1 승, 6 탈삼진, 4 방어율]`,
 * 마무리(0xb6ded == 2)면 첫째가 3(세이브)로 바뀐다 (B-season-awards.md B-2).
 *
 * 순위표 재료는 리그 투수 기록표(CPU 경기 0xc2a48 이 쌓은 것) + **내 선수 한 줄**이다.
 */

/** 보직 → 시상 종류 표 (0xb6ded == 2 구원 → 세이브왕) */
export function pitcherAwardRoleOf(career: PitcherCareer): AwardRole {
  return career.role === PITCHER_ROLE.relief ? '마무리' : '투수'
}

/**
 * 내 투수의 순위표 한 줄 — 칸 대응은 P1 6절 그대로다
 * (아웃 +0x20 · 실점 +0x22 · 세이브 +0x24 · 탈삼진 +0x26 · 승 +0x2e · 패 +0x2f).
 * ⚠️ 실점이 곧 자책점이다 — 웹에 실책 개념이 없다 (**근사다**. 원본 +0x22 도 자책을 가르지 않는다).
 */
export function myPitcherLeagueRecordOf(career: PitcherCareer): LeagueRecord {
  return {
    ...EMPTY_LEAGUE_RECORD,
    teamId: career.teamId,
    name: career.name,
    isMine: true,
    atBatsOrOuts: career.stats.outs,
    hits: career.stats.runsAllowed,
    saves: career.stats.saves,
    strikeouts: career.stats.strikeouts,
    earnedRuns: career.stats.runsAllowed,
    wins: career.stats.wins,
    losses: career.stats.losses,
  }
}

/** 순위표가 훑을 줄들 — 리그 투수 표 + 내 선수 (팀 명단 끝, 타자편 `careerLeagueRecordsOf` 와 같은 자리) */
export function pitcherLeagueRecordsOf(career: PitcherCareer): readonly LeagueRecord[] {
  return leaguePitcherRecordsOf(career.leaguePlayerStats, myPitcherLeagueRecordOf(career))
}

/**
 * 투수편 시상 한 번.
 *
 * ⚠️ MVP 의 둘째 갈래 "올해의 목표(단계 2) 4개 이상" 은 **아직 셀 수 없다** — 투수 목표 표
 * 0xd7e9a(마무리는 +0x82 뒤)가 `shared/config/original/yearGoals.ts` 에 안 뽑혀 있어
 * (생성기가 타자 표 0xd7f9e 만 읽는다) 달성 수가 없다. 그래서 0 을 넘긴다:
 * 투수편 MVP 는 당분간 **타이틀 3개 독식** 쪽으로만 난다. 목표 표가 들어오면 이 줄만 고치면 된다.
 */
export function judgePitcherSeasonAwards(career: PitcherCareer): SeasonAwards {
  return judgeAwards(
    { teamId: career.teamId, name: career.name, achievedGoalCount: 0 },
    pitcherLeagueRecordsOf(career),
    pitcherAwardRoleOf(career),
  )
}

/**
 * 시즌이 끝날 때 시상을 하고 **MVP 비트를 남긴다** (0x8dd60 → career+0x1ca).
 * 타자편 `seasonAwards.recordSeasonMvp` 와 같은 자리다.
 */
export function recordPitcherSeasonMvp(career: PitcherCareer): PitcherCareer {
  const awards = judgePitcherSeasonAwards(career)
  if (!awards.isMostValuablePlayer) return career
  return { ...career, mvpSeasonBits: recordMvpSeason(career.mvpSeasonBits, career.season) }
}

/**
 * 연봉협상 등급 k (0xa4d78) — 투수는 다승(마무리면 세이브)·탈삼진·방어율 1위 수 + MVP 면 2.
 * 연봉협상 이벤트(380~391)가 투수편 화면에 아직 없어 **값만 내 둔다** — 붙일 자리는
 * `app/model/usePitcherLeagueSession.ts` 의 `continueCareer`(502 "연봉 협상한다") 다.
 */
export function pitcherSalaryNegotiationRankOf(career: PitcherCareer): number {
  return salaryRankOf(judgePitcherSeasonAwards(career))
}
