import type { RandomPort } from '@/shared/api/random/randomPort'
import { clampTo, MONEY_LIMIT, MORALE_LIMIT, POPULARITY_LIMIT, REPUTATION_LIMIT } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord, SeasonState } from '@/entities/season-mode/model/seasonRecord'
import { EVENT_100_ID } from '@/entities/season-mode/model/seasonEventFlow/ids'
import { ILLNESS_COOLDOWN, ILLNESS_KIND_COUNT, ILLNESS_SLACK_TABLE } from '@/entities/season-mode/model/seasonEventFlow/illness'
import { withSeasonYearAdjust, type SeasonEventReward } from '@/entities/season-mode/model/seasonEventFlow/reward/rewards'

/** G 상한 (0x8c6ca 0x1869f) */
const GAME_POINT_LIMIT = 99_999
/** 첫 항목이 이 종류면 엔딩 진입 (0x8d4c4) */
const ENDING_REWARD_KIND = 21

export interface SeasonRewardApplication {
  readonly state: SeasonState
  /** 전역 G(+0x64)에 더할 값 — 0..99999 자르기는 지갑이 한다 */
  readonly gamePoint: number
  /** 보상 10 이 이벤트 100 에서 났다 → 전역 +0xbe = 1 (0x8c6fc~0x8c714) */
  readonly event100Awarded: boolean
  /** 첫 항목이 21 이면 엔딩 진입 (0x8d4c4) */
  readonly entersEnding: boolean
}

/** 항목을 차례로 먹이며 쌓는 칸 */
interface RewardTally {
  readonly record: SeasonRecord
  readonly teamMorale: number
  readonly gamePoint: number
  readonly event100Awarded: boolean
}

type RewardApplier = (tally: RewardTally, value: number, eventId: number, random: RandomPort) => RewardTally

/**
 * 질병 11 의 종류 — 값 > 0 은 알림 글 0x8beb8 이 이미 굴려 적은 번호(r + 1, `rewardNoticeOf`) — 0x8c718 은 그 번호를 건다.
 * 값 0 은 알림을 안 거친 재생(굴림 0xbfa55(0, 4) 한 번을 여기서). 음수는 그대로(낫는다)
 */
function rollIllnessKind(value: number, random: RandomPort): number {
  if (value !== 0) return value
  const roll = random.rand(0, ILLNESS_KIND_COUNT)
  return roll + 1
}

/** 11 — v > 0: SR+5 = v · SR+6 = 0xd4d98[v] · SR+0x7c = 20 / v ≤ 0: SR+5 = 0 · SR+6 = 0 · SR+0x7c = 20 */
const applyIllnessReward: RewardApplier = (tally, value, _eventId, random) => {
  const kind = rollIllnessKind(value, random)
  const illness = kind > 0 ? kind : 0
  const record = { ...tally.record, illness, illnessSlack: ILLNESS_SLACK_TABLE[illness] ?? 0, illnessCooldown: ILLNESS_COOLDOWN }
  return { ...tally, record }
}

/** 보상 종류마다 (점프표 0xd4e50). 4·6·7·9·13~20 은 나리 선수 칸을 만진다 — s_event 에 쓰는 곳이 없다. 21 은 `entersEnding` */
const REWARD_APPLIERS: Readonly<Record<number, RewardApplier>> = {
  0: (tally, value) => ({ ...tally, record: { ...tally.record, popularity: clampTo(tally.record.popularity + value, POPULARITY_LIMIT) } }),
  1: (tally, value) => ({ ...tally, record: { ...tally.record, reputation: clampTo(tally.record.reputation + value, REPUTATION_LIMIT) } }),
  2: (tally, value) => ({ ...tally, teamMorale: clampTo(tally.teamMorale + value, MORALE_LIMIT) }),
  3: (tally, value) => ({ ...tally, record: { ...tally.record, money: clampTo(tally.record.money + value, MONEY_LIMIT) } }),
  10: (tally, value, eventId) => ({
    ...tally,
    gamePoint: Math.min(tally.gamePoint + value, GAME_POINT_LIMIT),
    event100Awarded: tally.event100Awarded || eventId === EVENT_100_ID,
  }),
  11: applyIllnessReward,
}

/**
 * 보상 항목을 모드 2 대로 적용한다 (`0x8c460`, 점프표 0xd4e50):
 * ```
 * 0  인기도 SR+0x48 += v (0..9999)          1  평판 SR+0x62 += v (0..999)
 * 2  모드 2 는 팀 레코드 +2 사기 += v (0..100) 3  소지금 SR+2 += v (0..9999, 100만 단위)
 * 10 전역 G += v · 이벤트 100 이면 전역 +0xbe = 1
 * 11 v > 0: SR+5 = v · SR+6 = 0xd4d98[v] · SR+0x7c = 20 / v ≤ 0: SR+5 = 0 · SR+6 = 0 · SR+0x7c = 20
 * ```
 * 질병 11 은 적용 전에 보상 글 만들기 `0x8beb8` 이 **값 ≥ 0 이면 `rand(0,4)+1` 로 다시 쓴다**(0x8c1b6~)
 * — 490 의 값 0 이 실제로 병 1~4 가 된다. 난수는 그 자리에서 한 번 돈다.
 * 연차 보정(393~396)은 이 앞에서 `withSeasonYearAdjust` 로 먹인다.
 */
export function applySeasonEventRewards(
  state: SeasonState,
  rewards: readonly SeasonEventReward[],
  eventId: number,
  random: RandomPort,
): SeasonRewardApplication {
  const adjusted = withSeasonYearAdjust(rewards, eventId, state.record.yearIndex)
  let tally: RewardTally = { record: state.record, teamMorale: state.teamMorale, gamePoint: 0, event100Awarded: false }
  for (const reward of adjusted) {
    const apply = REWARD_APPLIERS[reward.kind]
    if (apply !== undefined) tally = apply(tally, reward.value, eventId, random)
  }
  return {
    state: { ...state, record: tally.record, teamMorale: tally.teamMorale },
    gamePoint: tally.gamePoint,
    event100Awarded: tally.event100Awarded,
    entersEnding: adjusted[0]?.kind === ENDING_REWARD_KIND,
  }
}
