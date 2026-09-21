import { ORIGINAL_TITLES } from '@/shared/config/original/titles'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { hasSkill, isSeasonFinished } from '@/entities/career/model/playerCareer'
import { effectiveAbilityOf } from '@/entities/career/model/condition'
import { battingAverageOf } from '@/entities/career/model/seasonStats'
import { careerMvpCount, hasBackToBackMvp, hasMvpInSeason } from '@/entities/awards/model/seasonAwards'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'

/**
 * 칭호(닉네임) — 원본 StrNICKNAME 128개는 **이름 64개(0~63) + 획득 조건 원문 64개(64~127)** 의 짝이다.
 * 예: 35 "안타제조기" ↔ 99 "통산 500안타 달성".
 *
 * 판정은 원본에선 0x1a1c0 한 함수가 한다 (P3 4절). 나만의리그 관리 화면에 들어올 때마다 번호 순서로
 * 검사해서 **처음 맞는 하나만** 팝업으로 주고, 확인하면 비트(+0x178)를 켜고 곧바로 장착(+0x1c4)한 뒤
 * 다음 프레임에 다시 판정한다. 웹은 여러 동작 뒤 한꺼번에 배열로 붙인다 (P3 9절 "부여 방식 차이").
 *
 * **번호 32~47 한 벌을 타자편·투수편이 같이 쓴다** (P3 7·8절). 식 안에서 `this+0xcc == 4`(타자편)로
 * 가르고, 이름·조건 문구만 투수편에서 +16 (48~63) 을 읽는다. 웹은 칭호를 **이름 문자열**로 들고 있어
 * 타자편이 32~47, 투수편이 48~63 이름을 쓰면 원본 비트 한 벌과 같은 뜻이 된다.
 */
const NAME_COUNT = ORIGINAL_TITLES.length / 2

export const TITLE_NAMES: readonly string[] = ORIGINAL_TITLES.slice(0, NAME_COUNT)

/** 칭호는 모두 64개 — 기록연감 칸도 공통 32 + 타자 16 + 투수 16 = 64 다 (P3 10-2) */
export const TITLE_COUNT = NAME_COUNT
/** 공통 칭호(어느 편에서 얻어도 한 칸)는 0~31 이다 */
export const COMMON_TITLE_COUNT = 32
/** 투수편 이름은 타자편 번호 + 16 (P3 2절 0x7d5ee) */
export const PITCHER_TITLE_OFFSET = 16

export function conditionTextOf(title: string): string | null {
  const index = TITLE_NAMES.indexOf(title)
  return index < 0 ? null : stripGameMarkup(ORIGINAL_TITLES[index + NAME_COUNT]).trim()
}

/** 이름 → 원본 번호. 모르는 이름이면 −1 */
export function titleNumberOf(title: string): number {
  return TITLE_NAMES.indexOf(title)
}

/**
 * 얻은 칭호 목록 (0x104cc) — **얻은 순서가 아니라 번호 오름차순**으로 보여 준다.
 * `#` 키 고르기 화면(하위 상태 129)과 기록연감이 이 순서를 쓴다 (P3 10-1).
 */
export function titleListOf(titles: readonly string[]): readonly string[] {
  return [...new Set(titles)]
    .filter((title) => titleNumberOf(title) >= 0)
    .sort((left, right) => titleNumberOf(left) - titleNumberOf(right))
}

/**
 * "닉네임 모두 수집" (0x28e98) — 공통 32 + 타자 16 + 투수 16 을 다 채우면 **60,000 G** 를 준다.
 * 웹은 이름이 64개 모두 다르니 이름 집합이 64개면 곧 완성이다.
 */
export const ALL_TITLES_REWARD_GAME_POINT = 60_000

export function isAllTitlesCollected(titles: readonly string[]): boolean {
  return titleListOf(titles).length >= TITLE_COUNT
}

/** StrNICKNAME[64+i] 의 연차·기준값 */
const NINTH_YEAR = 9
const FINAL_YEAR = 13
const SIXTH_YEAR = 6
/** 소지금은 만원 단위라 60억 = 600,000만 */
const MONEY_SIX_BILLION = 600_000
const FOUR_TENTHS = 0.4

/** 칭호 43 "통산 4할" 을 보는 경기 번호 — 6년차 18경기째 한 순간 (0x1ac34) */
const FOUR_TENTHS_CHECK_GAME = 18

/**
 * MVP 계열 칭호 (P3 5·7절) — 전부 **시즌 시작 때**(경기 수 0) 본다.
 * 연도별 MVP 비트 `career+0x1ca` 를 읽는다.
 */
const SEASON_START_GAMES = 0
/** 전설 스킬 — 그 조건이 "우승 8회 + MVP 7회" 라 칭호 13 이 이 스킬 하나만 본다 (0x1a36e) */
const LEGEND_SKILL = 7
/**
 * 칭호 34/50 이 보는 스킬 비트 11 (0x1a752).
 * 비트 11 은 타자편에선 표 11 "번트왕", 투수편에선 표 27 "닥터K" 다 — 투수 스킬은 **표 번호 − 16** 이
 * 비트 번호이기 때문이다 (웹 pitcherGameOptions 의 끈기 26→10 · 비겁자 34→18 · 혼신 39→23 과 같은 규칙).
 */
export const BUNT_KING_SKILL = 11

/**
 * 연애 이벤트 번호 (events.json) — 칭호 14~20 이 "본 적 있음"(0xb6e80)으로 본다 (P3 6절).
 */
export const ROMANCE_EVENT_IDS = {
  메디카: 300,
  레오니: 301,
  로제: 302,
  발렌타인: 303,
} as const

/**
 * 공통 칭호 0~31 이 보는 선수 값.
 * 원본은 선수 레코드 한 벌을 두 편이 같이 보지만, 웹은 타자·투수 커리어가 따로라 이 창구로 모은다.
 */
export interface TitleSubject {
  /** 연차 (1 = 1년차). 원본 +0xb3 은 0부터라 여기서 1을 더한 값이다 */
  readonly season: number
  /** 이번 시즌 치른 경기 수 (+0xb2) */
  readonly gamesPlayed: number
  readonly seasonFinished: boolean
  readonly popularity: number
  readonly reputation: number
  /** 소지금 (만원 단위) */
  readonly money: number
  /** 연도별 MVP 비트 (+0x1ca) */
  readonly mvpSeasonBits: number
  /** 우승 횟수 (+0x7a) — 웹은 정규시즌 1위 횟수를 이 칸으로 쓴다 */
  readonly championships: number
  /** 훈련 칸별 누적의 합 (Σ +0x4b..+0x4f) */
  readonly trainingTotal: number
  /** 지난 1년 외출 수 (+0x6a) */
  readonly outingsThisSeason: number
  /** 또또복권 1등 횟수 (+0x185) · 구매 수 (+0x186) */
  readonly lotteryFirstPrizes: number
  readonly lotteryPurchases: number
  /** 본 적 있는 이벤트 번호 (문자열) */
  readonly seenEventIds: readonly string[]
  /** 전설 스킬(비트 7) 보유 */
  readonly hasLegendSkill: boolean
}

type SubjectRule = (subject: TitleSubject) => boolean

const isSeasonStart = (subject: TitleSubject) => subject.gamesPlayed === SEASON_START_GAMES

const hasSeenEvent = (subject: TitleSubject, eventId: number) => subject.seenEventIds.includes(String(eventId))

const romanceCountOf = (subject: TitleSubject) =>
  Object.values(ROMANCE_EVENT_IDS).filter((eventId) => hasSeenEvent(subject, eventId)).length

/**
 * 공통 칭호 0~31 (P3 5·6절). 번호가 빠진 것은 웹에 그 칸이 없어서다:
 *   8  국가 대표  — 원본은 관리 장면 `this+0x2c == 1`(국가대표 선발 상태, **유력**) 에서 번호만 넣는다.
 *                  웹에는 국가대표 선발(이벤트 461~464)이 아직 없다.
 *   30 가짜 인간  — `s8 +0x184 > 4`(평판 0 상태 유지 카운터, **유력**). 웹에 그 카운터가 없다.
 * 1·9 는 판정 함수 밖 중간평가 화면(0x11e84)이 준다 — `seasonFlow.midSeasonTitlesOf`.
 */
const COMMON_RULES: Readonly<Record<number, SubjectRule>> = {
  0: () => true, // 지금부터 시작이다!
  // 2 최고의 루키 — 연차idx 1(2년차 시작) 이고 **1년차 MVP** (0x1a204)
  2: (s) => s.season === 2 && isSeasonStart(s) && hasMvpInSeason(s.mvpSeasonBits, 1),
  // 원본은 연차 인덱스 == 8, 즉 **9년차에만** 본다 (P3 9절). `>=` 면 10년차 이후에도 줘 버린다
  3: (s) => s.season === NINTH_YEAR && s.popularity >= 2000, // 9년차 인기도 2000이상
  4: (s) => s.season === NINTH_YEAR && s.reputation >= 750, // 9년차 평판 750이상
  // 5 우승청부업자 — 우승 5회 (0x1a29a, `s8 +0x7a > 4`)
  5: (s) => s.championships > 4,
  6: (s) => s.popularity >= 2000, // 인기도 2000이상
  7: (s) => s.popularity >= 4000, // 인기도 4000이상
  10: (s) => s.season >= FINAL_YEAR, // 13년차 선수 생활의 마무리
  // 11 야구의 정점 — 통산 MVP 6회 (0x1a32e, `> 5`)
  11: (s) => careerMvpCount(s.mvpSeasonBits) > 5,
  // 12 베이스볼 마스터 — 통산 MVP 10회 (0x1a34e, `> 9`)
  12: (s) => careerMvpCount(s.mvpSeasonBits) > 9,
  // 13 살아있는 전설 — 전설 스킬 보유 (0x1a36e). 그 스킬 조건이 우승 8회 + MVP 7회다 (A 문서)
  13: (s) => s.hasLegendSkill,
  // 14~17 — 연애 이벤트를 **본 적 있는가** (0xb6e80). 이름 순서가 아니라 이벤트 번호가 섞여 있다
  14: (s) => hasSeenEvent(s, ROMANCE_EVENT_IDS.메디카), // 간호사 페티쉬 — 이벤트 300
  15: (s) => hasSeenEvent(s, ROMANCE_EVENT_IDS.로제), // 로리콘은 범죄 — 이벤트 302
  16: (s) => hasSeenEvent(s, ROMANCE_EVENT_IDS.레오니), // 와일드 씽씽이 — 이벤트 301
  17: (s) => hasSeenEvent(s, ROMANCE_EVENT_IDS.발렌타인), // 피할 수 없는 유혹 — 이벤트 303
  18: (s) => romanceCountOf(s) > 1, // 사랑에 빠진 남자 — 여자친구 2명
  19: (s) => romanceCountOf(s) > 2, // 바람둥이 — 3명
  20: (s) => romanceCountOf(s) > 3, // 희대의 풍운아 — 4명
  21: (s) => s.lotteryFirstPrizes >= 5, // 또또복권 1등 5번 당첨
  22: (s) => s.lotteryPurchases >= 100, // 또또복권 100번 구매
  23: (s) => s.trainingTotal >= 200, // 훈련 횟수 200회
  24: (s) => s.trainingTotal >= 100, // 훈련 횟수 100회
  // 값은 원본과 같다. 시점만 다르다 — 원본은 **다음 시즌 첫 경기 전**에 지난해 값으로 본다.
  // 그래서 원본은 13년차(마지막 해) 외출을 볼 기회가 없는데, 여기서는 13년차 끝에도 준다 (P3 9절)
  25: (s) => s.seasonFinished && s.outingsThisSeason <= 2, // 1년간 외출 2회 이하
  26: (s) => s.seasonFinished && s.outingsThisSeason >= 20, // 1년간 외출 20회 이상
  27: (s) => s.reputation >= 999, // 평판 999
  28: (s) => s.reputation >= 700, // 평판 700
  29: (s) => s.reputation <= 0, // 평판 0
  31: (s) => s.money >= MONEY_SIX_BILLION, // 소지금 60억
}

/** 32/48 괴물 — 연차idx > 1 이고 시즌 시작이며 **2년 연속 MVP** (0x1a6b6). 두 편이 같은 식이다 */
export function matchesMonsterTitle(subject: TitleSubject): boolean {
  return subject.season > 2 && isSeasonStart(subject) && hasBackToBackMvp(subject.mvpSeasonBits)
}

/** 33/49 국민 — 연차idx > 3 이고 시즌 시작이며 통산 MVP 4회 (0x1a704, `> 3`). 두 편이 같은 식 */
export function matchesNationalTitle(subject: TitleSubject): boolean {
  return subject.season > 4 && isSeasonStart(subject) && careerMvpCount(subject.mvpSeasonBits) > 3
}

/**
 * 43/59 는 "연차idx == 5 && 경기 수 == 18" 인 관리 화면 진입에서만 본다 (0x1ac34).
 * 다른 때 4할이어도, 방어율 0.99 여도 주지 않는다.
 */
export function isSixthYearCheckPoint(subject: TitleSubject): boolean {
  return subject.season === SIXTH_YEAR && subject.gamesPlayed === FOUR_TENTHS_CHECK_GAME
}

const trainingTotalOf = (career: PlayerCareer) =>
  Object.values(career.trainingCounts).reduce((total, count) => total + count, 0)

/** 타자 커리어를 공통 판정이 보는 값으로 옮긴다 */
export function titleSubjectOfBatter(career: PlayerCareer): TitleSubject {
  return {
    season: career.season,
    gamesPlayed: career.gamesPlayed,
    seasonFinished: isSeasonFinished(career),
    popularity: career.popularity,
    reputation: career.reputation,
    money: career.money,
    mvpSeasonBits: career.mvpSeasonBits,
    championships: career.regularSeasonFirstCount,
    trainingTotal: trainingTotalOf(career),
    outingsThisSeason: career.outingsThisSeason,
    lotteryFirstPrizes: career.lotteryFirstPrizes,
    lotteryPurchases: career.lotteryPurchases,
    seenEventIds: career.seenEventIds,
    hasLegendSkill: hasSkill(career, LEGEND_SKILL),
  }
}

/** 실효 능력치 999 — 원본은 `0xb6414(...) > 998` 이다 (P3 7절) */
const MAXED_ABILITY = 998
/** 필살타법/마구 4단계 — `s8 +0x201 > 3` (0x1ae04). 필드 뜻은 조건 문구로 붙인 것이라 **유력**이다 */
const ALL_SPECIAL_SWING_LEVELS = 3

type BatterRule = (career: PlayerCareer) => boolean

/**
 * 타자편 전용 칭호 32~47 (P3 7절). 번호가 빠진 것:
 *   38 하이브리드 — `통산 도루 ≥ 100 && 홈런 ≥ 150`. 웹 SeasonStats 에 **도루 칸이 없다**.
 *   44 바람의 아들 — `실효 주루 > 799 && 통산 도루 ≥ 200`. 같은 이유.
 */
const BATTER_RULES: Readonly<Record<number, BatterRule>> = {
  // 32 괴물 타자 · 33 국민 타자 — 투수편 48·49 와 같은 식이다
  32: (career) => matchesMonsterTitle(titleSubjectOfBatter(career)),
  33: (career) => matchesNationalTitle(titleSubjectOfBatter(career)),
  // 34 번트의 귀재 — 스킬 비트 11(= 번트왕) 보유 (0x1a752). 스킬을 먼저 얻어야 한다
  34: (career) => hasSkill(career, BUNT_KING_SKILL),
  35: (career) => career.careerStats.hits >= 500, // 통산 500안타
  36: (career) => career.careerStats.runsBattedIn >= 300, // 통산 300타점
  37: ({ careerStats }) => careerStats.hits >= 700 && careerStats.runsBattedIn >= 400 && careerStats.homeRuns >= 250,
  39: (career) => career.bestHomeRunsInGame >= 4, // 한 경기 홈런 4회
  40: (career) => career.careerStats.homeRuns >= 100,
  41: (career) => career.careerStats.homeRuns >= 200,
  42: (career) => career.careerStats.homeRuns >= 300,
  // 원본은 **6년차 18경기째 딱 한 순간**만 본다 (P3 9절) — `>=` 면 그 뒤로 계속 판정한다
  43: (career) =>
    isSixthYearCheckPoint(titleSubjectOfBatter(career)) && (battingAverageOf(career.careerStats) ?? 0) >= FOUR_TENTHS,
  // 45 5툴 플레이어 — 실효 능력 넷 모두 999 (0x1ad7e). 장비·스킬·사기까지 본 값이다
  45: (career) => Object.values(effectiveAbilityOf(career)).every((value) => value > MAXED_ABILITY),
  // 46 약속된 승리의 타자 — 필살타법 4단계 모두 훈련 (0x1ae04). **근사다** — +0x201 의 뜻은 유력이다
  46: (career) => career.specialSwingLevel > ALL_SPECIAL_SWING_LEVELS,
  47: (career) => career.cycleHitGames >= 2, // 사이클링 히트 2회
}

/** 조건을 만족한 칭호 번호 — 원본 판정 순서대로 오름차순이다 */
export function matchedCommonTitleNumbers(subject: TitleSubject): readonly number[] {
  return Object.entries(COMMON_RULES)
    .filter(([, rule]) => rule(subject))
    .map(([index]) => Number(index))
}

/** 번호를 이름으로 바꾸고, 이미 가진 것은 뺀다 (원본은 비트 검사 0xa4088 이 같은 일을 한다) */
export function unownedTitleNamesOf(numbers: readonly number[], owned: readonly string[]): readonly string[] {
  return [...numbers]
    .sort((left, right) => left - right)
    .map((index) => TITLE_NAMES[index])
    .filter((title) => !owned.includes(title))
}

export function currentTitleOf(career: PlayerCareer): string {
  return career.titleIds[career.titleIds.length - 1] ?? TITLE_NAMES[0]
}

/** 조건을 만족했지만 아직 얻지 않은 칭호 (원본 번호 순) */
export function evaluateNewTitles(career: PlayerCareer): readonly string[] {
  const subject = titleSubjectOfBatter(career)
  const numbers = [
    ...matchedCommonTitleNumbers(subject),
    ...Object.entries(BATTER_RULES)
      .filter(([, rule]) => rule(career))
      .map(([index]) => Number(index)),
  ]
  return unownedTitleNamesOf(numbers, career.titleIds)
}

/**
 * 원본이 실제로 주는 **하나** (0x1a1c0 은 처음 맞는 하나만 this+0x270 에 쓴다).
 * 확인하면 다음 프레임에 다시 판정해서 이어서 준다 — 웹은 아직 한꺼번에 준다.
 */
export function nextTitleOf(career: PlayerCareer): string | null {
  return evaluateNewTitles(career)[0] ?? null
}

export function awardTitles(career: PlayerCareer, titles: readonly string[]): PlayerCareer {
  if (titles.length === 0) return career
  return { ...career, titleIds: [...career.titleIds, ...titles] }
}
