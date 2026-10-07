import type { EventReward } from '@/entities/story/model/eventReward'
import { EVENT_REWARD_KIND } from '@/entities/story/model/eventReward'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import { NO_ENTRY_USER_EVENT_INDEX } from '@/entities/pitcher-career/model/pitcherRotation'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'

/**
 * **투수편 연속 기록** — 모드 레코드 `0x1f8d5(전역, 3)` 의 `+0x1bc` u8 세 칸 (타자편 `PlayerCareer.streaks` 와 같은 칸).
 *
 * - 잇기: 경기 뒤 평가 0xa719c 의 모드 3 갈래(a7264~a7386)가 `0xa4ce0(S, 칸, 참?)` — 참이면 +1(u8), 아니면 0.
 *   평가가 도는 **정규시즌 경기만** 잇는다(유일한 호출지 0x4ea0c 가 포스트시즌 0x4f268 에서 건너뛴다).
 * - 지우기: 새 시즌 0x1b768 의 0x1b882 `memset(S+0x1bc, 0, 4)`.
 * - 읽기: 116 진입이 부르는 0x8a6fc(8a8d4~8af8c)가 표와 견줘 알림 줄과 **보상 명령**(종류 7)을 내장 이벤트에 쌓는다 —
 *   보상은 114 가 그 이벤트를 틀 때 먹는다(`pitcherStreakEventOf`).
 */
export interface PitcherStreaks {
  /** +0x1bc — 선발: 승리 · 구원: 승리 또는 세이브 */
  readonly win: number
  /** +0x1bd — 선발: 5탈삼진 이상 · 구원: 2탈삼진 이상 */
  readonly strikeout: number
  /** +0x1be — 패배 */
  readonly loss: number
}

export const EMPTY_PITCHER_STREAKS: PitcherStreaks = { win: 0, strikeout: 0, loss: 0 }

/** R+0x124 판정 코드 */
const DECISION_WIN = 1
const DECISION_LOSS = 2
const DECISION_SAVE = 3
/** 선발 탈삼진 문턱 `cmp 4; bgt` · 구원 `cmp 1; bgt` */
const STARTER_STRIKEOUT_ABOVE = 4
const RELIEF_STRIKEOUT_ABOVE = 1
/** 구원은 `state+0x6b > 6` 일 때만 잇는다 (a7328~a7336) */
const RELIEF_STREAK_INNING_ABOVE = 6

export interface PitcherStreakGame {
  /** 보직 `0xb6705` = 내 투수 레코드 `+0xb & 3` */
  readonly role: PitcherRole
  /** 날짜 카운터 g = `0x1fa2d(전역)+0xb2` — 평가는 하루 끝(0xb818c) 앞이라 오늘의 g 다 */
  readonly dayCounter: number
  /** 경기 끝 이닝 `[0x1552d0c]+0x6b` (0-기준) */
  readonly endedInningIndex: number
  /** R+0x124 */
  readonly decisionCode: number
  /** R+0x134 */
  readonly strikeouts: number
}

const step = (count: number, on: boolean) => (on ? (count + 1) & 0xff : 0)

/**
 * 0xa719c 모드 3 갈래의 연속 기록 잇기 (직접 떴다):
 * ```
 * 보직 == 0:  g(0x1fa2d+0xb2) 비트0 이 서 있으면(홀수 날 — 선발 아닌 날) 건너뜀 (a72ee~a72fe)
 *             [0] 판정 == 1 · [1] 탈삼진 > 4 · [2] 판정 == 2
 * 보직 != 0:  (s8)state+0x6b ≤ 6 이면 건너뜀 (a7328~a7336)
 *             [0] 판정 == 3 || 판정 == 1 · [1] 탈삼진 > 1 · [2] 판정 == 2
 * ```
 */
export function advancePitcherStreaks(streaks: PitcherStreaks, game: PitcherStreakGame): PitcherStreaks {
  if (game.role === PITCHER_ROLE.starter) {
    if ((game.dayCounter & 1) !== 0) return streaks
    return {
      win: step(streaks.win, game.decisionCode === DECISION_WIN),
      strikeout: step(streaks.strikeout, game.strikeouts > STARTER_STRIKEOUT_ABOVE),
      loss: step(streaks.loss, game.decisionCode === DECISION_LOSS),
    }
  }
  if (!(game.endedInningIndex > RELIEF_STREAK_INNING_ABOVE)) return streaks
  return {
    win: step(streaks.win, game.decisionCode === DECISION_SAVE || game.decisionCode === DECISION_WIN),
    strikeout: step(streaks.strikeout, game.strikeouts > RELIEF_STRIKEOUT_ABOVE),
    loss: step(streaks.loss, game.decisionCode === DECISION_LOSS),
  }
}

/** 표 0xd4e10 (스택 +0x44) */
const SHORT_STREAKS = [3, 5, 10, 15, 20]
/** 표 0xd4dfc (스택 +0x58) — 구원의 [1] 칸 (타자편 두 칸도 이 표) */
const LONG_STREAKS = [5, 10, 20, 30, 40]
/** 표 0xd4e24 (스택 +0x38) — [2] 칸, 두 편 공용 */
const LOSS_STREAKS = [3, 4, 5]
/** 표 0xd4ddc (스택 +0x78) — 투수편 좋은 연속 기록 평판 */
const GOOD_REWARDS = [5, 10, 15, 20, 30]
/** 표 0xd4df0 (스택 +0x6c) — 나쁜 연속 기록 평판. 선발은 두 배(8ab18 `lsls #1`) */
const LOSS_REWARDS = [-5, -10, -20]

/** StrUSER_EVT 글 번호 (0x8a93c~0x8ab80) */
const LABEL = {
  /** 0x6a "경기 연속 승리" — 선발 [0] */
  win: 106,
  /** 0x68 "경기 연속 세이브" — 구원 [0] */
  save: 104,
  /** 0x67 "경기 연속 5탈삼진 이상" — 선발 [1] */
  strikeout5: 103,
  /** 0x69 "경기 연속 2탈삼진 이상" — 구원 [1] */
  strikeout2: 105,
  /** 0x6b "경기 연속 패배" */
  loss: 107,
} as const
/** 0x6d "기복 없이 훌륭한 피칭을 하는구나…" (타자편은 0x6c) */
const GOOD_COMMENT = 109
/** 0x6e~0x70 — [2] 가 4 → 111 · 5 → 112 · 그 밖 110 (두 편 공용) */
const BAD_COMMENT_BASE = 110

/** 투수 보유 비트 (0xa3a75) — 보상 값은 비트 + 1 (8ad22~8af8a) */
const SKILL_BIT = { 집중: 15, 새가슴: 17, 더티볼: 20 } as const
/** 집중 — [1] 이 선발 12 · 구원 24 일 때 (8ad5e~8ad72) */
const FOCUS_STARTER_STREAK = 12
const FOCUS_RELIEF_STREAK = 24
/** 새가슴 얻기 — 연차 S+0xb3 > 1 이고 S+0x1d8[5](피안타) 가 선발 > 14 · 구원 > 5 (8adde~8ae66) */
const CHICKEN_HEART_YEAR_ABOVE = 1
const CHICKEN_HEART_STARTER_HITS_ABOVE = 14
const CHICKEN_HEART_RELIEF_HITS_ABOVE = 5
/** 새가슴 풀기 — 가졌고 [0] 이 선발 5 · 구원 7 (8aea0~8aeee) */
const CHICKEN_HEART_CLEAR_STARTER = 5
const CHICKEN_HEART_CLEAR_RELIEF = 7
/** 더티볼 얻기 — S+0x1d8[4](볼넷+사구) > 3 (8af2a~8af52) */
const DIRTY_BALL_WALKS_ABOVE = 3

export interface PitcherStreakItem {
  readonly count: number
  readonly labelIndex: number
}

/** 0x8a6fc 가 쌓는 투수편 연속 기록 알림 줄과 보상 명령 */
export interface PitcherStreakEvent {
  /** 좋은 칸 [0] · [1] (앞 칸이 있으면 둘 사이에 " /" — 0xcc298) */
  readonly good: readonly PitcherStreakItem[]
  /** 나쁜 칸 [2] */
  readonly bad: PitcherStreakItem | null
  /** "!N" + 109 (좋은 칸이 하나라도 있으면) */
  readonly goodCommentIndex: number | null
  /** "!N" + 110~112 */
  readonly badCommentIndex: number | null
  /** 보상 명령 (종류 7) — 평판 합(알림이 있을 때) 다음 스킬(종류 4) 차례 */
  readonly rewards: readonly EventReward[]
}

export interface PitcherStreakEventInput {
  readonly role: PitcherRole
  readonly streaks: PitcherStreaks
  /** S+0xb3 연차idx = 시즌 − 1 */
  readonly season: number
  /** 보유 비트 (`0xa3a75`) */
  readonly skillIds: readonly number[]
  /** 116 이 고른 감독 글 — 38 이면 0x8a6fc 가 연속 기록을 통째로 건너뛴다 (8a836~8a83c) */
  readonly managerCommentIndex: number
  /** S+0x1d8[4] 볼넷+사구 · [5] 피안타 (u8) */
  readonly walksAndHitByPitch: number
  readonly hitsAllowed: number
}

const EMPTY_EVENT: PitcherStreakEvent = { good: [], bad: null, goodCommentIndex: null, badCommentIndex: null, rewards: [] }

/**
 * **0x8a6fc 의 모드 3 갈래** (8a8d4~8af8c 직접 떴다). 보직(0xb6705) 0 이 선발 쪽이다.
 * ```
 * [0] 선발: 표 0xd4e10 → 글 106 · 구원: 표 0xd4e10 → 글 104      평판 0xd4ddc[i]
 * [1] 선발: 표 0xd4e10 → 글 103 · 구원: 표 0xd4dfc → 글 105      평판 0xd4ddc[i]
 * [2] 두 편: 표 0xd4e24 → 글 107                                   평판 0xd4df0[i] (선발 ×2)
 * 좋은 칸이 있으면 "!N"+109 · 나쁜 칸이 있으면 "!N"+(4 → 111 · 5 → 112 · 110)
 * 알림이 있으면 명령 종류 1(평판) = 합 — 이어서 스킬(종류 4):
 *   집중 15 (+16): 없고 [1] == 선발 12 · 구원 24
 *   새가슴 17 (+18): 없고 연차 > 1 이고 피안타 > 선발 14 · 구원 5 / (그 밖에) 가졌고 [0] == 선발 5 · 구원 7 → −18
 *   더티볼 20 (+21): 없고 볼넷+사구 > 3
 * ```
 */
export function pitcherStreakEventOf(input: PitcherStreakEventInput): PitcherStreakEvent {
  if (input.managerCommentIndex === NO_ENTRY_USER_EVENT_INDEX) return EMPTY_EVENT
  const isStarter = input.role === PITCHER_ROLE.starter
  const { streaks } = input
  const good: PitcherStreakItem[] = []
  let reputation = 0

  const winIndex = SHORT_STREAKS.indexOf(streaks.win)
  if (winIndex >= 0) {
    good.push({ count: streaks.win, labelIndex: isStarter ? LABEL.win : LABEL.save })
    reputation += GOOD_REWARDS[winIndex]
  }
  const strikeoutTable = isStarter ? SHORT_STREAKS : LONG_STREAKS
  const strikeoutIndex = strikeoutTable.indexOf(streaks.strikeout)
  if (strikeoutIndex >= 0) {
    good.push({ count: streaks.strikeout, labelIndex: isStarter ? LABEL.strikeout5 : LABEL.strikeout2 })
    reputation += GOOD_REWARDS[strikeoutIndex]
  }
  const lossIndex = LOSS_STREAKS.indexOf(streaks.loss)
  const bad = lossIndex >= 0 ? { count: streaks.loss, labelIndex: LABEL.loss } : null
  if (lossIndex >= 0) reputation += LOSS_REWARDS[lossIndex] * (isStarter ? 2 : 1)

  const rewards: EventReward[] = []
  // 명령 칸 +0x20 — 알림이 하나라도 있을 때만 (strh 라 s16)
  if (good.length > 0 || bad !== null) rewards.push({ kind: EVENT_REWARD_KIND.평판, value: (reputation << 16) >> 16 })

  const owns = (bit: number) => input.skillIds.includes(bit)
  const gain = (bit: number) => rewards.push({ kind: EVENT_REWARD_KIND.스킬, value: bit + 1 })
  const focusStreak = isStarter ? FOCUS_STARTER_STREAK : FOCUS_RELIEF_STREAK
  if (streaks.strikeout === focusStreak && !owns(SKILL_BIT.집중)) gain(SKILL_BIT.집중)
  if (input.season - 1 > CHICKEN_HEART_YEAR_ABOVE && !owns(SKILL_BIT.새가슴)) {
    const limit = isStarter ? CHICKEN_HEART_STARTER_HITS_ABOVE : CHICKEN_HEART_RELIEF_HITS_ABOVE
    if (input.hitsAllowed > limit) gain(SKILL_BIT.새가슴)
  } else if (owns(SKILL_BIT.새가슴)) {
    const clearAt = isStarter ? CHICKEN_HEART_CLEAR_STARTER : CHICKEN_HEART_CLEAR_RELIEF
    if (streaks.win === clearAt) rewards.push({ kind: EVENT_REWARD_KIND.스킬, value: -(SKILL_BIT.새가슴 + 1) })
  }
  if (!owns(SKILL_BIT.더티볼) && input.walksAndHitByPitch > DIRTY_BALL_WALKS_ABOVE) gain(SKILL_BIT.더티볼)

  return {
    good,
    bad,
    goodCommentIndex: good.length > 0 ? GOOD_COMMENT : null,
    badCommentIndex: bad === null ? null : BAD_COMMENT_BASE + (streaks.loss === 4 ? 1 : streaks.loss === 5 ? 2 : 0),
    rewards,
  }
}

/** 116 이 지금 커리어로 쌓는 연속 기록 몫 — 기록 줄(`lastGame`)이 없는 옛 저장은 116 평가 창도 없어 비운다 */
export function pitcherStreakEventOfCareer(
  career: Pick<PitcherCareer, 'role' | 'streaks' | 'season' | 'skillIds' | 'lastGame'>,
): PitcherStreakEvent {
  const { lastGame } = career
  if (lastGame === undefined) return EMPTY_EVENT
  return pitcherStreakEventOf({
    role: career.role,
    streaks: career.streaks ?? EMPTY_PITCHER_STREAKS,
    season: career.season,
    skillIds: career.skillIds,
    managerCommentIndex: lastGame.managerCommentIndex,
    walksAndHitByPitch: lastGame.walksAndHitByPitch ?? 0,
    hitsAllowed: lastGame.hitsAllowed ?? 0,
  })
}

/** 알림 줄 글 — `n경기 연속 …` 들을 원본 차례대로 잇는다(0xbc73d 숫자 · 0xbc965 덧붙이기). 글 표는 부르는 쪽이 준다 */
export function pitcherStreakMarkupOf(event: PitcherStreakEvent, texts: readonly string[]): string {
  const item = (entry: PitcherStreakItem) => `${entry.count}${texts[entry.labelIndex] ?? ''}`
  let markup = event.good.map(item).join(' /')
  if (event.bad !== null) markup += item(event.bad)
  if (event.goodCommentIndex !== null) markup += `!N${texts[event.goodCommentIndex] ?? ''}`
  if (event.badCommentIndex !== null) markup += `!N${texts[event.badCommentIndex] ?? ''}`
  return markup
}
