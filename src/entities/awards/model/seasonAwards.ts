import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { yearGoalsOf } from '@/entities/career/model/seasonFlow'
import {
  BATTING_AVERAGE_SCALE,
  EMPTY_LEAGUE_RECORD,
  LEADER_KIND,
  leaderOf,
} from '@/entities/awards/model/leaderboard'
import type { LeaderKind, LeagueRecord } from '@/entities/awards/model/leaderboard'

/**
 * 개인 타이틀(370~374)·시즌 MVP(375~377)·연봉협상 등급 k
 * (binary.mod 0x8dad4 · 0x8dd60 · 0xa4d78 — B-season-awards.md B-2·B-3·B-5, 모두 **확정**).
 *
 * ⚠️ **웹에 없어 아직 못 채우는 것**: 순위표를 만들려면 CPU 선수의 개인 시즌 성적이 있어야 한다
 * (`leaderboard.ts` 머리말 참고). 기록표를 넘기지 않으면 1위가 없어 수상도 MVP 도 없고,
 * 등급 k 는 0 이 된다 — 지금까지 `app/model/seasonEvents.ts` 가 상수로 박아 두던 값과 같다.
 * 다만 이제는 **상수가 아니라 계산 결과**라, 기록표만 생기면 그대로 살아난다.
 */

/** 시상 문구 StrUSER_EVT 번호 (표 0xd4e30) */
export const TITLE_USER_EVENT_INDEX = {
  홈런왕: 76,
  타점왕: 77,
  타율왕: 78,
  다승왕: 79,
  삼진왕: 80,
  방어왕: 81,
  세이브왕: 82,
} as const

export type TitleName = keyof typeof TITLE_USER_EVENT_INDEX

/** 내 선수가 타자인지 투수인지 — 원본 모드 3(나만의리그 투수)·4(나만의리그 타자) */
export type AwardRole = '타자' | '투수' | '마무리'

interface TitleSpec {
  readonly name: TitleName
  readonly kind: LeaderKind
}

/**
 * 타자 종류 표 0xd4f18 = `[9, 11, 12]` → 홈런왕·타점왕·타율왕.
 * 투수 종류 표 0xd4f24 = `[1, 6, 4, 13]` → 다승왕·삼진왕·방어왕 (13 은 `cmp #0xd` 로 건너뛴다).
 * 나만의리그 투수가 **마무리**(0xb6ded == 2)면 첫째가 3(세이브)로 바뀌어 세이브왕이 된다.
 */
const TITLE_SPECS: Readonly<Record<AwardRole, readonly TitleSpec[]>> = {
  타자: [
    { name: '홈런왕', kind: LEADER_KIND.홈런 },
    { name: '타점왕', kind: LEADER_KIND.타점 },
    { name: '타율왕', kind: LEADER_KIND.타율 },
  ],
  투수: [
    { name: '다승왕', kind: LEADER_KIND.승 },
    { name: '삼진왕', kind: LEADER_KIND.탈삼진 },
    { name: '방어왕', kind: LEADER_KIND.방어율 },
  ],
  마무리: [
    { name: '세이브왕', kind: LEADER_KIND.세이브 },
    { name: '삼진왕', kind: LEADER_KIND.탈삼진 },
    { name: '방어왕', kind: LEADER_KIND.방어율 },
  ],
}

/** 원본이 이벤트 객체에 들고 있는 타이틀 칸 하나 (+0x30c 팀 · +0x31c 이름 · +0x36c 내 것인가) */
export interface TitleSlot {
  readonly name: TitleName
  readonly kind: LeaderKind
  /** StrUSER_EVT 번호 */
  readonly userEventIndex: number
  /** 1위 팀 번호. 자격자가 없으면 **10** — 원본이 "없음" 으로 채워 두는 값이다 (0x8dad4) */
  readonly teamId: number
  /** 1위 선수 이름. 없으면 빈 문자열 */
  readonly winnerName: string
  /** 1위가 내 선수인가 (+0x36c[i]) = 수상 */
  readonly isMine: boolean
}

/** 수상자가 없을 때 채우는 팀 번호 — 원본 0x8dad4 가 칸을 10 으로 초기화한다 */
export const NO_TEAM = 10

/** 개인 타이틀 세 칸 (0x8dad4). 순위표 1위를 그대로 옮겨 적는다 */
export function judgeTitles(
  records: readonly LeagueRecord[],
  role: AwardRole = '타자',
): readonly TitleSlot[] {
  return TITLE_SPECS[role].map((spec) => {
    const leader = leaderOf(records, spec.kind)
    return {
      name: spec.name,
      kind: spec.kind,
      userEventIndex: TITLE_USER_EVENT_INDEX[spec.name],
      teamId: leader?.record.teamId ?? NO_TEAM,
      winnerName: leader?.record.name ?? '',
      isMine: leader?.record.isMine ?? false,
    }
  })
}

/**
 * 올해의 목표 달성 수 — **단계 2(MVP 판정용)** (0xa3de8, 인자 2).
 * 다섯 목표를 모두 `g + trunc(g × 10 / 100)` 으로 올려 잡고 연말과 같은 기준으로 센다.
 * (투수는 앞 둘 — 방어율·피안타 — 만 −10% 다. 웹에 투수 모드가 없어 타자 쪽만 옮긴다.)
 *
 * `seasonFlow.achievedGoalCount` 는 단계 0·1 만 알아서 여기에 단계 2 를 따로 둔다.
 */
const MVP_GOAL_RAISE_PERCENT = 10

export function achievedGoalCountForMvp(career: PlayerCareer): number {
  const [average, hits, homeRuns, runsBattedIn, popularityGain] = yearGoalsOf(career).map(
    (goal) => goal + Math.trunc((goal * MVP_GOAL_RAISE_PERCENT) / 100),
  )
  const { stats } = career
  const checks = [
    // 원본 타율 = min(1000, trunc(안타 × 1000 / 타수)) — 버림 (0xb8e3d)
    stats.atBats > 0 &&
      Math.min(BATTING_AVERAGE_SCALE, Math.trunc((stats.hits * BATTING_AVERAGE_SCALE) / stats.atBats)) >=
        average,
    stats.hits >= hits,
    stats.homeRuns >= homeRuns,
    stats.runsBattedIn >= runsBattedIn,
    career.popularity - career.popularityAtSeasonStart >= popularityGain,
  ]
  return checks.filter(Boolean).length
}

/** MVP 조건의 목표 달성 수 기준 — 원본은 `cmp r0,#3; ble` 라 **4 이상**이어야 한다 */
export const MVP_GOAL_COUNT = 4

/** 시즌 MVP 발표에 쓰는 사람 */
export interface AwardWinner {
  readonly teamId: number
  readonly name: string
}

export interface SeasonAwards {
  /** 타이틀 세 칸 (발표 순서 그대로) */
  readonly titles: readonly TitleSlot[]
  /** 내가 딴 타이틀 수 (0~3) */
  readonly wonCount: number
  /** 내가 시즌 MVP 인가 (이벤트 객체 +0x388) */
  readonly isMostValuablePlayer: boolean
  /** 발표할 MVP — 내가 아니면 **내가 못 딴 첫 타이틀의 수상자**다 (0x8df18). 없으면 null */
  readonly mostValuablePlayer: AwardWinner | null
}

/**
 * 시상 한 번 (0x8dad4 → 0x8dd60).
 *
 * MVP = **(타이틀 ≥ 1) AND (타이틀 3개 모두 OR 올해의 목표(단계 2) 달성 4개 이상)** — B-3 확정.
 * 0x8de58 이 세 칸을 한 번에 보고 모두 0 이면 바로 탈락시키므로, 목표를 다 채워도
 * **타이틀이 하나도 없으면 MVP 가 아니다**.
 */
export function judgeSeasonAwards(
  career: PlayerCareer,
  records: readonly LeagueRecord[],
  role: AwardRole = '타자',
): SeasonAwards {
  const titles = judgeTitles(records, role)
  const wonCount = titles.filter((title) => title.isMine).length
  const isMostValuablePlayer =
    wonCount >= 1 &&
    (wonCount === titles.length || achievedGoalCountForMvp(career) >= MVP_GOAL_COUNT)

  if (isMostValuablePlayer) {
    return {
      titles,
      wonCount,
      isMostValuablePlayer,
      mostValuablePlayer: { teamId: career.teamId, name: career.name },
    }
  }
  // MVP 가 아니면 내가 못 딴 **첫** 타이틀의 수상자를 MVP 로 보여 준다 (0x8df18)
  const shown = titles.find((title) => !title.isMine && title.winnerName !== '')
  return {
    titles,
    wonCount,
    isMostValuablePlayer,
    mostValuablePlayer: shown ? { teamId: shown.teamId, name: shown.winnerName } : null,
  }
}

// ─── 이벤트 번호와 보상 ────────────────────────────────────────────────────────

/** 370 "누가 얼마나 잘했는지" — 타이틀 발표 창(0x8b3bc)을 여는 이벤트 */
export const TITLE_INTRO_EVENT_ID = 370
/** 371 + 수상 개수 (0x8b04c) */
export const TITLE_RESULT_BASE_EVENT_ID = 371

export function titleResultEventId(wonCount: number): number {
  return TITLE_RESULT_BASE_EVENT_ID + wonCount
}

/** 수상 개수별 소지금 보상 (100만원 칸) — 371 없음 0 · 372 +3 · 373 +6 · 374 +10 */
const TITLE_REWARD_MONEY_UNITS: readonly number[] = [0, 3, 6, 10]

export function titleRewardMoneyUnitsOf(wonCount: number): number {
  return TITLE_REWARD_MONEY_UNITS[wonCount] ?? 0
}

/** 375 "별 중의 별 MVP 선발만 남았어" — MVP 발표 창(0x8b23c) */
export const MVP_INTRO_EVENT_ID = 375
export const MVP_MISSED_EVENT_ID = 376
export const MVP_EVENT_ID = 377

export function mvpResultEventId(isMostValuablePlayer: boolean): number {
  return isMostValuablePlayer ? MVP_EVENT_ID : MVP_MISSED_EVENT_ID
}

// ─── 연도별 MVP 비트 (career +0x1ca) ─────────────────────────────────────────

/**
 * `career+0x1ca` u16 — **그 해 MVP 비트**다 (0xa4d2c 가 `|= 1 << 연차idx`).
 * A 문서가 "미해결" 로 뒀던 칸을 B-5 가 확정했다.
 * 0xa4d50 은 bit0..12 를 세어 **통산 MVP 횟수**를 낸다 — 칭호 2(1년차 MVP)·11(6회)·12(10회)·
 * 13(7회)·32/48(2년 연속)·33/49(4회)가 이 수를 본다.
 *
 * ⚠️ 웹 `PlayerCareer` 에는 이 칸이 아직 없다(그 파일은 이번 작업 범위 밖이다). 그래서 여기서는
 * 비트를 다루는 순수 함수만 두고, 저장은 칸이 생길 때 잇는다. **올해 MVP 인지**는 저장 없이도
 * 같은 시즌 안에서 `judgeSeasonAwards` 로 다시 구할 수 있다 — 원본 0xa4d78 도 방금 세운 비트를
 * 그대로 읽는 것뿐이다.
 */
export const MVP_YEAR_COUNT = 13
const MVP_BITS_MASK = 0xffff

/** 연차(1부터) → 비트 자리 (연차idx = career+0xb3) */
function seasonBitOf(season: number): number {
  return 1 << (season - 1)
}

export function recordMvpSeason(bits: number, season: number): number {
  if (season < 1 || season > MVP_YEAR_COUNT) return bits
  return (bits | seasonBitOf(season)) & MVP_BITS_MASK
}

export function hasMvpInSeason(bits: number, season: number): boolean {
  if (season < 1 || season > MVP_YEAR_COUNT) return false
  return (bits & seasonBitOf(season)) !== 0
}

/** 통산 MVP 횟수 (0xa4d50 — bit0..12 만 센다) */
export function careerMvpCount(bits: number): number {
  let count = 0
  for (let season = 1; season <= MVP_YEAR_COUNT; season += 1) {
    if (hasMvpInSeason(bits, season)) count += 1
  }
  return count
}

/** 두 해 연속 MVP 인가 — 칭호 32 "괴물 타자" · 48 "괴물 투수" 가 본다 */
export function hasBackToBackMvp(bits: number): boolean {
  for (let season = 1; season < MVP_YEAR_COUNT; season += 1) {
    if (hasMvpInSeason(bits, season) && hasMvpInSeason(bits, season + 1)) return true
  }
  return false
}

// ─── 연봉협상 등급 k (0xa4d78) ───────────────────────────────────────────────

/** 올해 MVP 비트면 +2 */
export const MVP_SALARY_BONUS = 2
/** 타이틀 3개 + MVP 2 = 5 가 최대다 */
export const MAXIMUM_SALARY_RANK = 5

/**
 * 연봉협상 등급 k (0xa4d78, B-5 확정).
 *   타자: 홈런(9)·타점(11)·타율(12) 1위가 내 선수면 각 +1
 *   투수: 다승(1, 마무리면 세이브 3)·탈삼진(6)·방어율(4)
 *   그리고 **올해 MVP 비트면 +2**
 *
 * 이 k 가 `seasonFlow.salaryResultEventId` 의 구간으로 들어가 강경/정중 결과를 **결정적으로** 가른다:
 *   k=0 → 387/391 · k≤2 → 386/390 · k≤4 → 385/389 · k=5 → 384/388 (확률이 아니다).
 */
export function salaryRankOf(awards: SeasonAwards): number {
  return awards.wonCount + (awards.isMostValuablePlayer ? MVP_SALARY_BONUS : 0)
}

/**
 * 웹에 아직 리그 선수 기록표가 없다는 사실을 한 곳에 모아 둔 값.
 * `leagueDay.ts` 가 선수별 성적을 쌓기 시작하면 이 자리에 그 표를 넘기면 된다.
 */
export const NO_LEAGUE_RECORDS: readonly LeagueRecord[] = []

/**
 * `app/model/seasonEvents.ts` 가 쓰는 입구 — 커리어 하나로 등급 k 를 낸다.
 *
 * ⚠️ 기록표를 안 넘기면 순위표가 비어 **k = 0** 이다(강경 387 −20% / 정중 391 −10%).
 * 지어낸 CPU 성적으로 채우지 않는다 — `leaderboard.ts` 머리말에 적은 대로 원본은 CPU 경기에서
 * 실제로 쌓은 기록만 본다. 내 선수 하나만 넣어도 안 된다(혼자면 늘 3관왕이 된다).
 */
export function salaryNegotiationRankOf(
  career: PlayerCareer,
  records: readonly LeagueRecord[] = NO_LEAGUE_RECORDS,
  role: AwardRole = '타자',
): number {
  return salaryRankOf(judgeSeasonAwards(career, records, role))
}

/**
 * 내 선수의 순위표 한 줄. 리그 기록표를 만들 때 **내 팀 명단 자리에** 끼워 넣는 용도다.
 * (원본은 내 선수 레코드가 팀 명단 안에 있어 동점 순서까지 자연히 맞는다. 웹은 명단이
 * `shared/config` 의 붙박이 표라 순서를 흉내 내야 한다 — 부르는 쪽이 자리를 정한다.)
 *
 * 투수 칸(세이브·탈삼진·승·패·자책점)은 채우지 않는다. `career.stats.strikeouts` 는
 * **타자가 당한 삼진**이라 원본 +0x26(투수 탈삼진)과 뜻이 다르다.
 */
export function myLeagueRecordOf(career: PlayerCareer): LeagueRecord {
  return {
    ...EMPTY_LEAGUE_RECORD,
    teamId: career.teamId,
    name: career.name,
    isMine: true,
    atBatsOrOuts: career.stats.atBats,
    hits: career.stats.hits,
    homeRuns: career.stats.homeRuns,
    runsBattedIn: career.stats.runsBattedIn,
  }
}
