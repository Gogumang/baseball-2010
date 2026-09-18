import { ACE_CHALLENGE_MISSIONS } from '@/entities/mission/model/missionGoal'
import { ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import type { OriginalMission } from '@/shared/config/original/missions'
import type { EventReward } from '@/entities/story/model/eventReward'

/**
 * r_event `match` 명령 = 마선수 대결 (누락 탐색 8차).
 *   team     16~20 = 마투수 5명 — StrCOMMON[15~19] 순서가 ACE_PITCHERS 순서와 같다
 *   결과     resultEvents[0] 승리 · [1] 패배 이벤트로 이어 간다 (승리 쪽에 보상이 붙어 있다)
 * 대결 형식은 미션 레코드 중 단계 0 "OO 공략" 이라고 본다 — 타자편 레코드 16~20 이
 * 같은 순서의 마투수(opponentAce 1~5)를 상대로 한 타석 안에 안타를 요구한다 (추정: 명령과 레코드를 잇는 코드는 미확인).
 */
const FIRST_ACE_MATCH_TEAM = 16

export function aceMatchPitcherOf(team: number): AcePlayer | null {
  return ACE_PITCHERS[team - FIRST_ACE_MATCH_TEAM] ?? null
}

export function aceMatchMissionOf(team: number): OriginalMission | null {
  if (aceMatchPitcherOf(team) === null) return null
  const order = team - FIRST_ACE_MATCH_TEAM + 1
  return ACE_CHALLENGE_MISSIONS.find((mission) => mission.side === '타자' && mission.opponentAce === order) ?? null
}

export function matchResultEventOf(resultEvents: readonly number[], isWin: boolean): number {
  return resultEvents[isWin ? 0 : 1]
}

/** 대결 동안 잠시 멈춘 이벤트가 모아 둔 보상·본 이벤트 — 결과 이벤트가 끝날 때 함께 넘긴다 */
export interface StoryCarry {
  readonly rewards: readonly EventReward[]
  readonly viewedEventIds: readonly number[]
}

export const EMPTY_STORY_CARRY: StoryCarry = { rewards: [], viewedEventIds: [] }

/**
 * 앞 이벤트가 들고 온 것 + 이번 재생에서 지나온 칸(키 "이벤트번호:명령번호")별 보상을 합친다.
 * 본 이벤트는 겹치지 않게 한 번씩만 남긴다.
 */
export function mergeStoryCarry(
  carried: StoryCarry,
  rewardsByCursor: ReadonlyMap<string, readonly EventReward[]>,
): StoryCarry {
  const viewed = [...rewardsByCursor.keys()].map((key) => Number(key.split(':')[0]))
  return {
    rewards: [...carried.rewards, ...[...rewardsByCursor.values()].flat()],
    viewedEventIds: [...new Set([...carried.viewedEventIds, ...viewed])],
  }
}
