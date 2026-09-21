import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  effectivePitcherAbilityOf,
  hasPitcherSkill,
  isPitcherSeasonFinished,
  seasonEarnedRunAverageOf,
} from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { TitleSubject } from '@/entities/career/model/titles'
import {
  BUNT_KING_SKILL,
  isSixthYearCheckPoint,
  matchedCommonTitleNumbers,
  matchesMonsterTitle,
  matchesNationalTitle,
  PITCHER_TITLE_OFFSET,
  unownedTitleNamesOf,
} from '@/entities/career/model/titles'

/**
 * 투수편 칭호 (P3 7·8절 확정).
 *
 * 원본은 **번호 32~47 한 벌을 두 편이 같이 쓴다**. 판정 0x1a1c0 은 32~47 만 검사하고 식 안에서
 * `this+0xcc == 4`(타자편)인지로 가르며, 이름·조건 문구만 투수편에서 +16 (48~63 / 112~127) 을 읽는다.
 * 웹은 칭호를 이름 문자열로 들고 있어, 투수 커리어가 48~63 이름을 쓰면 그대로 원본과 같은 뜻이 된다.
 *
 * 공통 칭호 0~31 은 타자편과 같은 표(`COMMON_RULES`)를 쓴다.
 */

/** 전설 스킬은 공통 비트 7 이라 두 편이 같다 */
const LEGEND_SKILL = 7
/** 실효 능력치 999 — 원본은 `0xb6414(...) > 998` */
const MAXED_ABILITY = 998
/** 마구 4단계 모두 훈련 — `s8 +0x201 > 3` (0x1ae04). 필드 뜻은 **유력**이라 근사다 */
const ALL_MAGIC_LEVELS = 3
/** 미스터 제로 — 통산 방어율 0.99 이하. 원본은 ×100 정수로 `≤ 99` 를 본다 (0x1ac60) */
const ZERO_ERA_LIMIT = 99

/** 세이브P = 세이브 + 승 (0xb6dec 보직이 구원일 때만 본다, P3 7절) */
export function savePointsOf(career: PitcherCareer): number {
  return career.careerStats.saves + career.careerStats.wins
}

/** 보직 0 = 선발, 그 밖은 구원 (`rec[+0xb] & 3`) */
const isRelief = (career: PitcherCareer) => career.role !== PITCHER_ROLE.starter
const isStarter = (career: PitcherCareer) => career.role === PITCHER_ROLE.starter

const trainingTotalOf = (career: PitcherCareer) =>
  Object.values(career.trainingCounts).reduce((total, count) => total + count, 0)

/**
 * 투수 커리어를 공통 판정이 보는 값으로 옮긴다.
 *
 * ⚠️ 투수 커리어에는 **또또복권 칸(+0x185/+0x186)이 없다** — 0 으로 넘겨서 칭호 21·22 는 아직 나오지 않는다.
 */
export function titleSubjectOfPitcher(career: PitcherCareer): TitleSubject {
  return {
    season: career.season,
    gamesPlayed: career.gamesPlayed,
    seasonFinished: isPitcherSeasonFinished(career),
    popularity: career.popularity,
    reputation: career.reputation,
    money: career.money,
    mvpSeasonBits: career.mvpSeasonBits,
    championships: career.regularSeasonFirstCount,
    trainingTotal: trainingTotalOf(career),
    outingsThisSeason: career.outingsThisSeason,
    lotteryFirstPrizes: 0,
    lotteryPurchases: 0,
    seenEventIds: career.seenEventIds,
    hasLegendSkill: hasPitcherSkill(career, LEGEND_SKILL),
  }
}

type PitcherRule = (career: PitcherCareer) => boolean

/**
 * 투수편 전용 칭호 48~63 (P3 8절). 번호가 빠진 것:
 *   60 철완 28호      — `실효 체력 > 799 && Σ u16 +0x1f0[0..3] ≥ 20`. 웹에 **완투 계열 누적 칸이 없다**.
 *   63 퍼펙트 플레이어 — `u16 +0x1f0[0] > 1` (퍼펙트 2회). 웹에 **퍼펙트 누적 칸이 없다**.
 */
const PITCHER_RULES: Readonly<Record<number, PitcherRule>> = {
  // 48 괴물 투수 — 2년 연속 MVP, 시즌 시작 때 (타자편 32 와 같은 식)
  48: (career) => matchesMonsterTitle(titleSubjectOfPitcher(career)),
  // 49 국민 투수 — 통산 MVP 4회, 시즌 시작 때 (타자편 33 과 같은 식)
  49: (career) => matchesNationalTitle(titleSubjectOfPitcher(career)),
  // 50 닥터 K — 스킬 비트 11 보유 (0x1a752). 투수 스킬 비트는 표 번호 − 16 이라 표 27 "닥터K" 다
  50: (career) => hasPitcherSkill(career, BUNT_KING_SKILL),
  51: (career) => career.careerStats.strikeouts >= 1000, // 초강력 탈삼진머신
  52: (career) => career.careerStats.strikeouts >= 1500, // 미스터 언터쳐블
  53: (career) => isRelief(career) && savePointsOf(career) >= 50, // 떠오르는 구원왕
  54: (career) => isRelief(career) && savePointsOf(career) >= 100, // 철벽 마무리
  55: (career) => isRelief(career) && savePointsOf(career) >= 200, // 그라운드의 수호신
  56: (career) => isStarter(career) && career.careerStats.wins >= 50, // 떠오르는 에이스
  57: (career) => isStarter(career) && career.careerStats.wins >= 100, // 넘버원 에이스
  58: (career) => isStarter(career) && career.careerStats.wins >= 200, // 그라운드의 지배자
  // 59 미스터 제로 — 타자편 43 과 같은 시점(6년차 18경기째)에서 통산 방어율 0.99 이하 (0x1ac60).
  // 통산 아웃이 0 이면 실점도 0 일 때만 준다 — `seasonEarnedRunAverageOf` 가 그 식 그대로다
  59: (career) =>
    isSixthYearCheckPoint(titleSubjectOfPitcher(career)) &&
    seasonEarnedRunAverageOf(career.careerStats) <= ZERO_ERA_LIMIT,
  // 61 초음속 폭격기 — 실효 제구·구속·변화가 모두 999 (0x1ad7e). 체력은 보지 않는다
  61: (career) => {
    const ability = effectivePitcherAbilityOf(career)
    return ability.control > MAXED_ABILITY && ability.velocity > MAXED_ABILITY && ability.breaking > MAXED_ABILITY
  },
  // 62 마탄의 투수 — 마구 4단계 모두 훈련 (0x1ae04, `s8 +0x201 > 3`). **근사다** — 필드 뜻이 유력이다
  62: (career) => career.magicLevel > ALL_MAGIC_LEVELS,
}

/** 조건을 만족했지만 아직 얻지 않은 투수편 칭호 (원본 번호 순) */
export function evaluateNewPitcherTitles(career: PitcherCareer): readonly string[] {
  const numbers = [
    ...matchedCommonTitleNumbers(titleSubjectOfPitcher(career)),
    ...Object.entries(PITCHER_RULES)
      .filter(([, rule]) => rule(career))
      .map(([index]) => Number(index)),
  ]
  return unownedTitleNamesOf(numbers, career.titleIds)
}

/** 원본이 실제로 주는 하나 (0x1a1c0 은 처음 맞는 하나만 준다) */
export function nextPitcherTitleOf(career: PitcherCareer): string | null {
  return evaluateNewPitcherTitles(career)[0] ?? null
}

export function awardPitcherTitles(career: PitcherCareer, titles: readonly string[]): PitcherCareer {
  if (titles.length === 0) return career
  return { ...career, titleIds: [...career.titleIds, ...titles] }
}

/** 투수편 전용 번호인가 (48~63). 기록연감이 편별로 따로 세는 칸이다 (P3 10-2) */
export function isPitcherOnlyTitleNumber(index: number): boolean {
  return index >= 32 + PITCHER_TITLE_OFFSET
}
