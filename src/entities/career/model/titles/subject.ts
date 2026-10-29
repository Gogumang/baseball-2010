import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { hasSkill, isSeasonFinished } from '@/entities/career/model/playerCareer'
import { careerMvpCount, hasBackToBackMvp } from '@/entities/career/model/titles/otherSlices'

const SIXTH_YEAR = 6
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
  /** 외출 칸 +0x6a(지난해 몫 + 새 시즌 g == 0 창 몫) — 칭호 25·26 이 **새 시즌 첫 경기 전**에 이 값을 본다 */
  readonly outingsLastSeason: number
  /** 또또복권 1등 횟수 (+0x185) · 구매 수 (+0x186) */
  readonly lotteryFirstPrizes: number
  readonly lotteryPurchases: number
  /** 본 적 있는 이벤트 번호 (문자열) */
  readonly seenEventIds: readonly string[]
  /** 전설 스킬(비트 7) 보유 */
  readonly hasLegendSkill: boolean
  /** 평판 0 으로 끝난 경기 뒤 평가 연속 수 (+0x184, u8) — 칭호 30 이 `s8` 로 읽는다 */
  readonly reputationZeroGames: number
}

export const isSeasonStart = (subject: TitleSubject) => subject.gamesPlayed === SEASON_START_GAMES

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

const trainingTotalOf = (career: PlayerCareer) => Object.values(career.trainingCounts).reduce((total, count) => total + count, 0)

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
    // 원본 +0x6a 한 칸 = 두 칸의 합 (`PlayerCareer.outingsLastSeason` 주석 — 새 시즌 g == 0 창의 외출도 든다)
    outingsLastSeason: career.outingsLastSeason + career.outingsThisSeason,
    lotteryFirstPrizes: career.lotteryFirstPrizes,
    lotteryPurchases: career.lotteryPurchases,
    seenEventIds: career.seenEventIds,
    hasLegendSkill: hasSkill(career, LEGEND_SKILL),
    reputationZeroGames: career.reputationZeroGames,
  }
}
