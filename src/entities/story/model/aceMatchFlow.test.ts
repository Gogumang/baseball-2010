import { describe, expect, it } from 'vitest'
import { ORIGINAL_EVENTS } from '@/shared/config/original/events'
import { stepFrom, jumpToEvent, advanceCursor } from '@/entities/story/model/eventScript'
import { aceMatchMissionOf, matchResultEventOf, mergeStoryCarry, EMPTY_STORY_CARRY } from '@/entities/story/model/aceMatch'
import type { StoryCarry } from '@/entities/story/model/aceMatch'
import { rewardsIn } from '@/entities/story/model/eventReward'
import { applyEventRewards } from '@/entities/story/model/eventReward'
import { applyOutcome, startMission } from '@/entities/mission/model/missionRun'
import { createCareer } from '@/entities/career/model/playerCareer'
import { branchOnlyEventIds } from '@/entities/story/model/storyScene'

/**
 * 이벤트 112(싸이커 친선경기) → 대결 → 결과 이벤트까지 원본 데이터로 이어 본다.
 * 승리 경로가 패배 경로와 실제로 다른 결과를 주는지 확인한다 — "이벤트가 떴다" 만 보면
 * 승리 경로가 조용히 패배 쪽으로 새는 회귀를 잡지 못한다.
 */

/** StoryScreen 이 하는 재생을 테스트에서 똑같이 돌린다 — 멈춤 명령을 차례로 지나며 보상을 모은다 */
function playEvent(startEventId: number, carried: StoryCarry = EMPTY_STORY_CARRY) {
  const rewardsByCursor = new Map<string, ReturnType<typeof rewardsIn>>()
  let cursor = jumpToEvent(startEventId)
  for (let guard = 0; guard < 200; guard += 1) {
    const step = stepFrom(ORIGINAL_EVENTS, cursor)
    rewardsByCursor.set(`${step.cursor.eventId}:${step.cursor.commandIndex}`, rewardsIn(step.passed))
    if (step.command === null) return { kind: '끝' as const, carry: mergeStoryCarry(carried, rewardsByCursor) }
    if (step.command.op === 'match') {
      return { kind: '대결' as const, command: step.command, carry: mergeStoryCarry(carried, rewardsByCursor) }
    }
    cursor = advanceCursor(step.cursor)
  }
  throw new Error('이벤트가 끝나지 않았다')
}

const SIKER_MATCH_EVENT_ID = 112

describe('마선수 대결 승리 경로 (이벤트 112 → 대결 → 114)', () => {
  it('이벤트 112 는 싸이커 공략 레코드로 대결을 연다', () => {
    const played = playEvent(SIKER_MATCH_EVENT_ID)

    expect(played.kind).toBe('대결')
    if (played.kind !== '대결') return
    expect(played.command.team).toBe(16)
    expect(aceMatchMissionOf(played.command.team)).toMatchObject({ side: '타자', name: '싸이커', opponentAce: 1 })
  })

  it('안타 한 개로 대결에 이기면 114 로, 지면 115 로 간다', () => {
    const played = playEvent(SIKER_MATCH_EVENT_ID)
    if (played.kind !== '대결') throw new Error('대결로 이어지지 않았다')
    const mission = aceMatchMissionOf(played.command.team)
    if (mission === null) throw new Error('공략 레코드가 없다')

    const won = applyOutcome(startMission(mission), { kind: '안타', bases: 1 })
    const lost = applyOutcome(startMission(mission), { kind: '삼진' })

    expect(won.status, `won.status: ${won.status}`).toBe('성공')
    expect(lost.status, `lost.status: ${lost.status}`).toBe('실패')
    expect(matchResultEventOf(played.command.resultEvents, won.status === '성공')).toBe(114)
    expect(matchResultEventOf(played.command.resultEvents, lost.status === '성공')).toBe(115)
  })

  it('승리 보상(G포인트·평판)이 패배 보상(사기 하락)과 구분된다', () => {
    const before = createCareer('테스터')
    const carried = playEvent(SIKER_MATCH_EVENT_ID).carry

    const afterWin = applyEventRewards(before, playEvent(114, carried).carry.rewards)
    const afterLoss = applyEventRewards(before, playEvent(115, carried).carry.rewards)

    expect(afterWin.gamePoint - before.gamePoint, `gamePoint: ${afterWin.gamePoint}`).toBe(500)
    expect(afterWin.reputation - before.reputation).toBe(10)
    expect(afterWin.morale).toBe(before.morale)
    expect(afterLoss.morale - before.morale, `morale: ${afterLoss.morale}`).toBe(-10)
    expect(afterLoss.gamePoint).toBe(before.gamePoint)
  })

  it('결과 이벤트 114·115 는 본 이벤트로 기록되고, 따로 다시 뜨지 않는다', () => {
    const carried = playEvent(SIKER_MATCH_EVENT_ID).carry
    const afterWin = playEvent(114, carried).carry

    expect(afterWin.viewedEventIds).toContain(SIKER_MATCH_EVENT_ID)
    expect(afterWin.viewedEventIds).toContain(114)
    // 결과 이벤트는 trigger 1(외출)이라 기록이 없으면 대결과 무관하게 떠 버린다 — 분기 전용으로 걸러야 한다
    expect(branchOnlyEventIds(ORIGINAL_EVENTS).has(114)).toBe(true)
    expect(branchOnlyEventIds(ORIGINAL_EVENTS).has(115)).toBe(true)
  })
})
