import { LEADER_KIND } from '@/entities/awards/model/leaderboard'
import type { LeaderKind } from '@/entities/awards/model/leaderboard'

/**
 * **시즌모드(모드 2)** 시상 단계가 트는 s_event 번호와 보상 — `docs/re/P4-season-flow.md` 2a·2b 절 (확정).
 *
 * ⚠️ **나만의리그(모드 3·4)와 번호가 다르다.** `entities/awards/model/seasonAwards.ts` 의
 * `titleResultEventId`(371 + 수상 개수)·`mvpResultEventId`(376/377) 는 **나리 전용**이다
 * (B 4절: "0x8b04c 에서 mode 2 쪽은 s_event 번호 372/373 타자·374/375 투수").
 * 시즌모드는 수상 개수를 세지 않고 **우리 팀 수상자가 있느냐 없느냐**로만 갈린다.
 *
 * | 상태 | 여는 이벤트 | 결과 이벤트 |
 * |---|---|---|
 * | 0xeb 타자시상 | 370 (SYS 3) | 372 없음 / **373** 수상 |
 * | 0xec 투수시상 | 371 (SYS 3) | 374 없음 / **375** 수상 |
 * | 0xed 최우수선수 | 376 (SYS 4) | 378 없음 / **379** MVP |
 */

/** 시상 화면이 여는 이벤트 — 0xeb 370 · 0xec 371 · 0xed 376 (P4 2b 표) */
export const SEASON_AWARD_INTRO_EVENT_ID = { 타자: 370, 투수: 371, MVP: 376 } as const

/** 시상 대상 — 0xeb 는 타자, 0xec 는 투수다 */
export type SeasonAwardRole = '타자' | '투수'

/** 결과 이벤트 — 우리 팀 수상자가 없으면 372·374, 있으면 373·375 (P4 2a) */
export const SEASON_TITLE_RESULT_EVENT_ID: Readonly<Record<SeasonAwardRole, readonly [number, number]>> = {
  타자: [372, 373],
  투수: [374, 375],
}

export function seasonTitleResultEventId(role: SeasonAwardRole, hasWinner: boolean): number {
  return SEASON_TITLE_RESULT_EVENT_ID[role][hasWinner ? 1 : 0]
}

/** MVP 결과 이벤트 — 378 없음 / 379 있음 (P4 2a) */
export const SEASON_MVP_RESULT_EVENT_ID: readonly [number, number] = [378, 379]

export function seasonMvpResultEventId(isMine: boolean): number {
  return SEASON_MVP_RESULT_EVENT_ID[isMine ? 1 : 0]
}

/** s_event 보상 한 줄 (소지금은 100만 원 단위 — 보상 3 → SR+2, A-6) */
export interface SeasonAwardReward {
  readonly popularity: number
  readonly reputation: number
  readonly money: number
}

const NOTHING: SeasonAwardReward = { popularity: 0, reputation: 0, money: 0 }

/**
 * 시상 결과 이벤트의 보상 (P4 2a 표, 확정):
 * - 373 · 375 "우수 타자 / 투수 수상" → 평판 +10 · 소지금 +5 (500만)
 * - 379 "MVP 있음" → 인기도 +10 · 평판 +20 · 소지금 +10 (1000만)
 * - 372 · 374 · 378 은 보상 칸이 비어 있다.
 *
 * ⚠️ 연차 보정(A-6 의 `+5y` 같은 것)은 **목표 보상 393·394·396 에만** 붙는다 — 시상 쪽에는
 * 보정이 적혀 있지 않아 그대로 둔다.
 */
export const SEASON_AWARD_REWARDS: Readonly<Record<number, SeasonAwardReward>> = {
  372: NOTHING,
  373: { popularity: 0, reputation: 10, money: 5 },
  374: NOTHING,
  375: { popularity: 0, reputation: 10, money: 5 },
  378: NOTHING,
  379: { popularity: 10, reputation: 20, money: 10 },
}

export function seasonAwardRewardOf(eventId: number): SeasonAwardReward {
  return SEASON_AWARD_REWARDS[eventId] ?? NOTHING
}

/**
 * 시즌모드 MVP 후보 종류 표 **0xd4f34** = `[9, 11, 12, 1, 6, 4, 3]` (B-3 확정).
 *
 * 나리는 타이틀 세 칸으로 MVP 를 판정하지만, **시즌모드는 이 일곱 종류 중 `rand(0..6)` 하나를 골라
 * 그 순위표의 1위를 MVP 로 발표하고, 그 팀이 내 팀이면 플래그를 세운다.**
 * 굴림에는 난수가 필요해 화면에서 하지 않는다 — 이 표와 `entities/awards` 의 `leaderOf` 로
 * **부르는 쪽**이 고른 뒤 `SeasonMvpScreen` 에 결과만 넘긴다.
 */
export const SEASON_MVP_LEADER_KINDS: readonly LeaderKind[] = [
  LEADER_KIND.홈런,
  LEADER_KIND.타점,
  LEADER_KIND.타율,
  LEADER_KIND.승,
  LEADER_KIND.탈삼진,
  LEADER_KIND.방어율,
  LEADER_KIND.세이브,
]

/**
 * 시즌모드 **투수 타이틀은 네 칸**이다 — 표 0xd4f24 = `[1, 6, 4, 13]` 의 넷째가
 * 시즌모드에서는 **3(세이브)** 으로 바뀐다 (B 4절 2번: "시즌모드는 넷째가 3(세이브, 문자열 82)").
 *
 * `entities/awards/model/seasonAwards.ts` 의 `judgeTitles(records, '시즌투수')` 가 이 네 칸을 돌려준다
 * (나리 `'투수'` 는 세 칸이라 섞지 말 것). 여기에는 종류만 남겨 둔다.
 */
export const SEASON_PITCHER_TITLE_KINDS: readonly LeaderKind[] = [
  LEADER_KIND.승,
  LEADER_KIND.탈삼진,
  LEADER_KIND.방어율,
  LEADER_KIND.세이브,
]
