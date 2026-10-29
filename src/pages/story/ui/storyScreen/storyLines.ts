import { SPEAKER_NAMES } from '@/shared/config/original/eventMeta'
import type { EventCommand } from '@/shared/config/original/eventTypes'
import type { EventStep } from '@/entities/story/model/eventScript'
import { rewardNoticeOf } from '@/entities/story/model/rewardNotice'
import type { RewardNotice, RewardNoticeContext } from '@/entities/story/model/rewardNotice'
import { SYSTEM_YEAR_GOAL_WINDOW } from '@/pages/story/lib/yearGoalWindow'
import type { YearGoalWindowSource } from '@/pages/story/lib/yearGoalWindow'
import type { RewardNoticeOf, SystemCommand } from '@/pages/story/model/eventPlayback/playbackTypes'
import type { StoryScreenProps } from './storyScreenProps'

/** 화자 번호 1 은 플레이어 이름으로 바꾼다. */
const PLAYER_SPEAKER = 1
/** 대사 fmt 9 는 %s 자리에 팀 이름을 넣는다 (그 밖에는 선수 이름). */
const TEAM_NAME_FORMAT = 9

/** 0x8bab8 — 말하는 이 [명령+0x20]: 1 은 선수 이름(시즌모드면 빈 머리말) · 2~24 는 StrMODE[말하는 이 + 91] · 그 밖 없음 */
export function speakerNameOf(command: EventCommand | null, { isSeasonMode = false, playerName }: StoryScreenProps): string | null {
  if (command?.op !== 'say' || command.speaker === 0) return null
  if (command.speaker !== PLAYER_SPEAKER) return SPEAKER_NAMES[command.speaker] ?? null
  return isSeasonMode ? null : playerName
}

/** `%s` 자리 글 — 이벤트별 서식(380 연봉 0x8bc4c)이 없으면 fmt 9 는 팀 이름, 그 밖은 (선수 이름, 팀 이름) */
export function replacementsOf(
  command: EventCommand | null,
  eventId: number,
  { replacementsFor, playerName, teamName }: StoryScreenProps,
): readonly string[] {
  return replacementsFor?.(eventId) ?? (command?.op === 'say' && command.format === TEAM_NAME_FORMAT ? [teamName] : [playerName, teamName])
}

/** 창 글 — 목표 창도 재생기가 멈추는 창이다: 글 대신 빈 글로 세워 두고 화면이 창을 그린다. 둘 다 없으면 창 없이 지나간다 */
export function storyWindowTextOf(
  systemWindowTextOf: ((command: SystemCommand) => string | null) | undefined,
  yearGoalWindowOf: (() => YearGoalWindowSource) | undefined,
): ((command: SystemCommand) => string | null) | undefined {
  if (systemWindowTextOf === undefined && yearGoalWindowOf === undefined) return undefined
  return (command) => (command.sub === SYSTEM_YEAR_GOAL_WINDOW && yearGoalWindowOf !== undefined ? '' : (systemWindowTextOf?.(command) ?? null))
}

/** 보상 명령 7 의 알림 — 맥락을 주었을 때만 (`rewardNoticeContext`) */
export const rewardNoticeOfContext = (context: (() => RewardNoticeContext) | undefined): RewardNoticeOf | undefined =>
  context === undefined ? undefined : (items, eventId) => rewardNoticeOf(items, eventId, context())

/** 지금 돌고 있는 보상 창(알림 · 스킬) — 열쇠는 그 명령 자리 */
export function currentRewardOf(command: EventCommand | null, rewardNotice: RewardNotice | null, key: string): ShownReward | null {
  if (command?.op !== 'reward' || rewardNotice === null) return null
  return rewardNotice.kind === '알림' || rewardNotice.kind === '스킬' ? { key, notice: rewardNotice } : null
}

export interface ShownReward {
  readonly key: string
  readonly notice: RewardNotice
}

/** 경기 명령(0x8d8c4~0x8d8f0)과 재생 끝(0x8d1b6 → 0x8d4e2)은 초상화 · 상자 높이 · 글 칸 셋을 비운다 — 그 틀부터 상자를 안 그린다 */
export const isBoxClearedOf = (step: EventStep, isReleased: boolean) => isReleased && (step.command === null || step.command.op === 'match')

/** 올해의 목표 창(system 1)을 그리는가 — 창 값을 주었을 때만 */
export const isYearGoalWindowOf = (command: EventCommand | null, yearGoalWindowOf: (() => YearGoalWindowSource) | undefined) =>
  command?.op === 'system' && command.sub === SYSTEM_YEAR_GOAL_WINDOW && yearGoalWindowOf !== undefined
