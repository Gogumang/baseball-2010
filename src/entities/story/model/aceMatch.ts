import { missionOpponentOf } from '@/entities/game/model/aceOpponent'
import { MISSIONS } from '@/shared/config/original/missions'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import type { OriginalMission } from '@/shared/config/original/missions'
import type { EventReward } from '@/entities/story/model/eventReward'

/**
 * r_event `match` 명령 = 마선수 대결 (이벤트 SYS 종류 8, `0x8d734`).
 *
 * **명령과 미션 레코드를 잇는 규칙은 확정됐다 (S13 4-1)**: `0x8d764` 가
 * `[sp+0x14] = u8 rec[4] − 1` 을 그대로 전역 기록에 적는다 —
 * `g[0xf7]`(타자편) / `g[0x175]`(투수편) = **미션 레코드 번호 = `team − 1`**(0부터).
 * 편은 이벤트 쪽이 정한다 (`evt[0x20] == 4` 타자편 · `== 3` 투수편).
 * 웹은 나만의리그 **타자편**만 있으므로 기본값을 '타자' 로 둔다.
 *
 * 이벤트 데이터가 쓰는 team 은 16~20 뿐이라(events.json 전수) 레코드 15~19 =
 * 단계 0 "OO 공략" 다섯 개에 그대로 떨어진다.
 * 결과는 `resultEvents[0]` 승리 · `[1]` 패배로 이어 간다 (`0x10e40`, 확정).
 */
export function aceMatchMissionOf(
  team: number,
  side: OriginalMission['side'] = '타자',
): OriginalMission | null {
  // 원본은 편별 미션 표의 **레코드 번호**(0부터)를 그대로 쓴다 — 범위 검사도 재배열도 없다.
  // 웹의 `mission.id` 는 레코드가 들고 있는 1부터의 번호라 `레코드 번호 + 1 = team` 이 된다.
  // (배열 자리로 세면 안 된다 — 생성기가 이름 없는 빈 레코드[타자 15번]를 빼고 담았다.)
  return MISSIONS.find((mission) => mission.side === side && mission.id === team) ?? null
}

/** 그 레코드가 상대로 세우는 마투수. 일반 선수(`opponentAce` 0)면 없다 */
export function aceMatchPitcherOf(team: number): AcePlayer | null {
  const mission = aceMatchMissionOf(team)
  if (mission === null || mission.opponentAce === 0) return null
  return missionOpponentOf('투수', mission.opponentAce)
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
