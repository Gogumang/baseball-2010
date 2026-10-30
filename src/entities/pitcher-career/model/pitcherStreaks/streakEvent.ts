import type { EventReward } from '@/entities/pitcher-career/model/pitcherStreaks/otherSlices'
import { EVENT_REWARD_KIND } from '@/entities/pitcher-career/model/pitcherStreaks/otherSlices'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'
import { NO_ENTRY_USER_EVENT_INDEX } from '@/entities/pitcher-career/model/pitcherRotation'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { EMPTY_PITCHER_STREAKS } from '@/entities/pitcher-career/model/pitcherStreaks/streakCounts'
import type { PitcherStreaks } from '@/entities/pitcher-career/model/pitcherStreaks/streakCounts'
import { streakSkillRewardsOf } from '@/entities/pitcher-career/model/pitcherStreaks/streakSkillRewards'

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
const BAD_COMMENT_OFFSET_BY_LOSSES: Readonly<Record<number, number>> = { 4: 1, 5: 2 }

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
  const good = goodStreakItemsOf(streaks, isStarter)
  const lossIndex = LOSS_STREAKS.indexOf(streaks.loss)
  const bad = lossIndex >= 0 ? { count: streaks.loss, labelIndex: LABEL.loss } : null

  const rewards: EventReward[] = []
  // 명령 칸 +0x20 — 알림이 하나라도 있을 때만 (strh 라 s16)
  if (good.length > 0 || bad !== null) rewards.push({ kind: EVENT_REWARD_KIND.평판, value: (streakReputationOf(streaks, isStarter) << 16) >> 16 })
  rewards.push(...streakSkillRewardsOf(input, isStarter))

  return {
    good,
    bad,
    goodCommentIndex: good.length > 0 ? GOOD_COMMENT : null,
    badCommentIndex: bad === null ? null : BAD_COMMENT_BASE + (BAD_COMMENT_OFFSET_BY_LOSSES[streaks.loss] ?? 0),
    rewards,
  }
}

/** [1] 칸의 표 — 선발 0xd4e10 · 구원 0xd4dfc */
const strikeoutStreaksOf = (isStarter: boolean): readonly number[] => (isStarter ? SHORT_STREAKS : LONG_STREAKS)

/** 좋은 칸 [0] · [1] — 표에 든 칸만 */
function goodStreakItemsOf(streaks: PitcherStreaks, isStarter: boolean): PitcherStreakItem[] {
  const good: PitcherStreakItem[] = []
  if (SHORT_STREAKS.includes(streaks.win)) good.push({ count: streaks.win, labelIndex: isStarter ? LABEL.win : LABEL.save })
  if (strikeoutStreaksOf(isStarter).includes(streaks.strikeout)) {
    good.push({ count: streaks.strikeout, labelIndex: isStarter ? LABEL.strikeout5 : LABEL.strikeout2 })
  }
  return good
}

/** 표에 든 칸의 평판 — 표 밖이면 0 */
const rewardAt = (rewards: readonly number[], index: number): number => (index >= 0 ? rewards[index] : 0)

/** 평판 합 — 좋은 칸 0xd4ddc[i] · 나쁜 칸 0xd4df0[i](선발 ×2) */
function streakReputationOf(streaks: PitcherStreaks, isStarter: boolean): number {
  const win = rewardAt(GOOD_REWARDS, SHORT_STREAKS.indexOf(streaks.win))
  const strikeout = rewardAt(GOOD_REWARDS, strikeoutStreaksOf(isStarter).indexOf(streaks.strikeout))
  const loss = rewardAt(LOSS_REWARDS, LOSS_STREAKS.indexOf(streaks.loss)) * (isStarter ? 2 : 1)
  return win + strikeout + loss
}

/** 116 이 지금 커리어로 쌓는 연속 기록 몫 — 기록 줄(`lastGame`)이 없는 옛 저장은 116 평가 창도 없어 비운다 */
export function pitcherStreakEventOfCareer(career: Pick<PitcherCareer, 'role' | 'streaks' | 'season' | 'skillIds' | 'lastGame'>): PitcherStreakEvent {
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

/** 0xcc298 — 좋은 칸 사이 글 " / " (0x8aa1c~0x8aa28: 첫 칸이 있었으면 둘째 칸 앞에 덧붙인다 — 모드 3 · 4 같은 길) */
const GOOD_SEPARATOR = ' / '

/** 알림 줄 글 — `n경기 연속 …` 들을 원본 차례대로 잇는다(0xbc73d 숫자 · 0xbc965 덧붙이기). 글 표는 부르는 쪽이 준다 */
export function pitcherStreakMarkupOf(event: PitcherStreakEvent, texts: readonly string[]): string {
  const item = (entry: PitcherStreakItem) => `${entry.count}${texts[entry.labelIndex] ?? ''}`
  let markup = event.good.map(item).join(GOOD_SEPARATOR)
  if (event.bad !== null) markup += item(event.bad)
  if (event.goodCommentIndex !== null) markup += `!N${texts[event.goodCommentIndex] ?? ''}`
  if (event.badCommentIndex !== null) markup += `!N${texts[event.badCommentIndex] ?? ''}`
  return markup
}
