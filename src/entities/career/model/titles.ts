import { ORIGINAL_TITLES } from '@/shared/config/original/titles'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { hasSkill, isSeasonFinished } from '@/entities/career/model/playerCareer'
import { battingAverageOf } from '@/entities/career/model/seasonStats'
import { careerMvpCount, hasBackToBackMvp, hasMvpInSeason } from '@/entities/awards/model/seasonAwards'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'

/**
 * 칭호(닉네임) — 원본 StrNICKNAME 128개는 **이름 64개(0~63) + 획득 조건 원문 64개(64~127)** 의 짝이다.
 * 예: 35 "안타제조기" ↔ 99 "통산 500안타 달성".
 *
 * 아래 표는 조건 원문을 그대로 코드로 옮긴 것이다. 지금 웹판이 기록하지 않는 것
 * (MVP·우승·국가대표·마선수 공략·또또복권·도루·번트 시도·투수 기록·능력치 999)은 아직 판정하지 않는다.
 */
const NAME_COUNT = ORIGINAL_TITLES.length / 2

export const TITLE_NAMES: readonly string[] = ORIGINAL_TITLES.slice(0, NAME_COUNT)

export function conditionTextOf(title: string): string | null {
  const index = TITLE_NAMES.indexOf(title)
  return index < 0 ? null : stripGameMarkup(ORIGINAL_TITLES[index + NAME_COUNT]).trim()
}

/** StrNICKNAME[64+i] 의 연차·기준값 */
const NINTH_YEAR = 9
const FINAL_YEAR = 13
const SIXTH_YEAR = 6
/** 소지금은 만원 단위라 60억 = 600,000만 */
const MONEY_SIX_BILLION = 600_000
const FOUR_TENTHS = 0.4

type TitleRule = (career: PlayerCareer) => boolean

/** 칭호 43 "통산 4할" 을 보는 경기 번호 — 6년차 18경기째 한 순간 (0x1b214) */
const FOUR_TENTHS_CHECK_GAME = 18

const trainingTotalOf = (career: PlayerCareer) =>
  Object.values(career.trainingCounts).reduce((total, count) => total + count, 0)

/**
 * MVP 계열 칭호 (P3 9절·10절) — 전부 **시즌 시작 때**(경기 수 0) 본다.
 * 연도별 MVP 비트 `career+0x1ca` 를 읽는다.
 */
const SEASON_START_GAMES = 0
/** 전설 스킬 — 그 조건이 "우승 8회 + MVP 7회" 라 칭호 13 이 이 스킬 하나만 본다 (0x1a36e) */
const LEGEND_SKILL = 7
const isSeasonStart = (career: PlayerCareer) => career.gamesPlayed === SEASON_START_GAMES

const RULES: Readonly<Record<number, TitleRule>> = {
  0: () => true, // 지금부터 시작이다!
  // 2 최고의 루키 — 연차idx 1(2년차 시작) 이고 **1년차 MVP** (0x1a204)
  2: (career) => career.season === 2 && isSeasonStart(career) && hasMvpInSeason(career.mvpSeasonBits, 1),
  // 11 야구의 정점 — 통산 MVP 6회 (0x1a32e, `> 5`)
  11: (career) => careerMvpCount(career.mvpSeasonBits) > 5,
  // 12 베이스볼 마스터 — 통산 MVP 10회 (0x1a34e, `> 9`)
  12: (career) => careerMvpCount(career.mvpSeasonBits) > 9,
  // 13 살아있는 전설 — 전설 스킬 보유 (0x1a36e). 그 스킬 조건이 우승 8회 + MVP 7회다 (A 문서)
  13: (career) => hasSkill(career, LEGEND_SKILL),
  // 32 괴물 타자 — 연차idx > 1 이고 시즌 시작이며 **2년 연속 MVP** (0x1a6b6)
  32: (career) => career.season > 2 && isSeasonStart(career) && hasBackToBackMvp(career.mvpSeasonBits),
  // 33 국민 타자 — 연차idx > 3 이고 시즌 시작이며 통산 MVP 4회 (0x1a704, `> 3`)
  33: (career) => career.season > 4 && isSeasonStart(career) && careerMvpCount(career.mvpSeasonBits) > 3,
  // 원본은 연차 인덱스 == 8, 즉 **9년차에만** 본다 (P3 9절). `>=` 면 10년차 이후에도 줘 버린다
  3: (career) => career.season === NINTH_YEAR && career.popularity >= 2000, // 9년차 인기도 2000이상
  4: (career) => career.season === NINTH_YEAR && career.reputation >= 750, // 9년차 평판 750이상
  6: (career) => career.popularity >= 2000, // 인기도 2000이상
  7: (career) => career.popularity >= 4000, // 인기도 4000이상
  10: (career) => career.season >= FINAL_YEAR, // 13년차 선수 생활의 마무리
  21: (career) => career.lotteryFirstPrizes >= 5, // 또또복권 1등 5번 당첨
  22: (career) => career.lotteryPurchases >= 100, // 또또복권 100번 구매
  23: (career) => trainingTotalOf(career) >= 200, // 훈련 횟수 200회
  24: (career) => trainingTotalOf(career) >= 100, // 훈련 횟수 100회
  // 값은 원본과 같다. 시점만 다르다 — 원본은 **다음 시즌 첫 경기 전**에 지난해 값으로 본다.
  // 그래서 원본은 13년차(마지막 해) 외출을 볼 기회가 없는데, 여기서는 13년차 끝에도 준다 (P3 9절)
  25: (career) => isSeasonFinished(career) && career.outingsThisSeason <= 2, // 1년간 외출 2회 이하
  26: (career) => isSeasonFinished(career) && career.outingsThisSeason >= 20, // 1년간 외출 20회 이상
  27: (career) => career.reputation >= 999, // 평판 999
  28: (career) => career.reputation >= 700, // 평판 700
  29: (career) => career.reputation <= 0, // 평판 0
  31: (career) => career.money >= MONEY_SIX_BILLION, // 소지금 60억
  35: (career) => career.careerStats.hits >= 500, // 통산 500안타
  36: (career) => career.careerStats.runsBattedIn >= 300, // 통산 300타점
  37: ({ careerStats }) => careerStats.hits >= 700 && careerStats.runsBattedIn >= 400 && careerStats.homeRuns >= 250,
  39: (career) => career.bestHomeRunsInGame >= 4, // 한 경기 홈런 4회
  40: (career) => career.careerStats.homeRuns >= 100,
  41: (career) => career.careerStats.homeRuns >= 200,
  42: (career) => career.careerStats.homeRuns >= 300,
  // 원본은 **6년차 18경기째 딱 한 순간**만 본다 (P3 9절) — `>=` 면 그 뒤로 계속 판정한다
  43: (career) =>
    career.season === SIXTH_YEAR &&
    career.gamesPlayed === FOUR_TENTHS_CHECK_GAME &&
    (battingAverageOf(career.careerStats) ?? 0) >= FOUR_TENTHS,
  47: (career) => career.cycleHitGames >= 2, // 사이클링 히트 2회
}

export function currentTitleOf(career: PlayerCareer): string {
  return career.titleIds[career.titleIds.length - 1] ?? TITLE_NAMES[0]
}

/** 조건을 만족했지만 아직 얻지 않은 칭호 (원본 번호 순) */
export function evaluateNewTitles(career: PlayerCareer): readonly string[] {
  return Object.entries(RULES)
    .filter(([, rule]) => rule(career))
    .map(([index]) => TITLE_NAMES[Number(index)])
    .filter((title) => !career.titleIds.includes(title))
}

export function awardTitles(career: PlayerCareer, titles: readonly string[]): PlayerCareer {
  if (titles.length === 0) return career
  return { ...career, titleIds: [...career.titleIds, ...titles] }
}
