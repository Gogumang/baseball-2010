import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { hasSkill } from '@/entities/career/model/playerCareer'
import { equippedAbilityOf } from '@/entities/career/model/condition'
import { battingAverageOf } from '@/entities/career/model/seasonStats'
import { isSixthYearCheckPoint, matchesMonsterTitle, matchesNationalTitle, titleSubjectOfBatter } from '@/entities/career/model/titles/subject'

const FOUR_TENTHS = 0.4

/**
 * 칭호 34/50 이 보는 스킬 비트 11 (0x1a752).
 * 비트 11 은 타자편에선 표 11 "번트왕", 투수편에선 표 27 "닥터K" 다 — 투수 스킬은 **표 번호 − 16** 이
 * 비트 번호이기 때문이다 (웹 pitcherGameOptions 의 끈기 26→10 · 비겁자 34→18 · 혼신 39→23 과 같은 규칙).
 */
export const BUNT_KING_SKILL = 11

/** 실효 능력치 999 — 원본은 `0xb6415(기록, k, 1) > 998` 이다 (P3 7절, 0x1ad9a~0x1adfc) */
const MAXED_ABILITY = 998
/** 필살타법/마구 4단계 — `s8 +0x201 > 3` (0x1ae04). 필드 뜻은 조건 문구로 붙인 것이라 **유력**이다 */
const ALL_SPECIAL_SWING_LEVELS = 3

type BatterRule = (career: PlayerCareer) => boolean

/**
 * 타자편 전용 칭호 32~47 (P3 7절). 39 는 이 판정에 없다(116 진입이 준다).
 * 38 · 44 의 통산 도루는 0x9dbc0 이 연도 기록 +0x2c 를 더한 값 — 웹은 `careerStats.stolenBases`(동료 간이 타석에서 내가 뛴 도루,
 * 옛 저장 0)다.
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
  // 38 하이브리드 — 통산 도루 ≥ 100 && 홈런 ≥ 150 (0x1a986)
  38: ({ careerStats }) => (careerStats.stolenBases ?? 0) >= 100 && careerStats.homeRuns >= 150,
  // 39 다이너마이트 배트는 0x1a1c0 에 없다 — 116 진입이 이 경기 홈런으로 직접 준다 (`gameResultTitleOf`)
  40: (career) => career.careerStats.homeRuns >= 100,
  41: (career) => career.careerStats.homeRuns >= 200,
  42: (career) => career.careerStats.homeRuns >= 300,
  // 원본은 **6년차 18경기째 딱 한 순간**만 본다 (P3 9절) — `>=` 면 그 뒤로 계속 판정한다
  43: (career) => isSixthYearCheckPoint(titleSubjectOfBatter(career)) && (battingAverageOf(career.careerStats) ?? 0) >= FOUR_TENTHS,
  // 44 바람의 아들 — 실효 주루 `0xb6415(기록, 3, 1) > 799`(0x1ad14~0x1ad22) && 통산 도루 ≥ 200 (0x1acf2)
  44: (career) => equippedAbilityOf(career).run > 799 && (career.careerStats.stolenBases ?? 0) >= 200,
  // 45 5툴 플레이어 — 모드 4 갈래(0x1ad94 `cmp #4`)는 k = 0~3 넷 모두 `0xb6415(기록, k, 1) > 998` (0x1ad9a~0x1adfc).
  // 0xb570c 가 아니라 0xb6414 를 바로 읽으니 장비·장착 스킬까지만 보고 **질병·부상·사기 감소는 안 본다**
  45: (career) => Object.values(equippedAbilityOf(career)).every((value) => value > MAXED_ABILITY),
  // 46 약속된 승리의 타자 — 필살타법 4단계 모두 훈련 (0x1ae04). **근사다** — +0x201 의 뜻은 유력이다
  46: (career) => career.specialSwingLevel > ALL_SPECIAL_SWING_LEVELS,
  47: (career) => career.cycleHitGames >= 2, // 사이클링 히트 2회
}

/** 타자편 전용 칭호 중 조건을 만족한 번호 — 오름차순 */
export function matchedBatterTitleNumbers(career: PlayerCareer): readonly number[] {
  return Object.entries(BATTER_RULES)
    .filter(([, rule]) => rule(career))
    .map(([index]) => Number(index))
}
