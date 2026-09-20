// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useMissionSession } from '@/app/model/useMissionSession'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import type { Screen } from '@/app/model/screen'
import { aceMatchMissionOf, EMPTY_STORY_CARRY } from '@/entities/story/model/aceMatch'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { MissionRecordPort } from '@/shared/api/save/missionRecordPort'

/**
 * 이벤트 112 의 match 명령이 여는 마선수 대결 — 이기면 114, 지면 115 로 돌아가야 한다.
 * 브라우저에서 승리 타구를 맞히기 어려워 이 경로만 훅 수준에서 끝까지 돌린다.
 */

const SIKER_TEAM = 16
const WIN_EVENT_ID = 114
const LOSE_EVENT_ID = 115

function setUpSession() {
  const missionRecord: MissionRecordPort = { load: () => ({}), save: vi.fn() }
  const random = createSeededRandom(1)
  let screen: Screen = { kind: '관리' }
  const setScreen = vi.fn((next: Screen) => {
    screen = next
  })

  const rendered = renderHook(() => {
    const runner = useAtBatRunner()
    return {
      runner,
      session: useMissionSession({ runner, random, missionRecord, screen, setScreen }),
    }
  })

  return { rendered, setScreen, screenNow: () => screen }
}

/** 대결을 시작하고 타구 하나로 끝낸다 */
function playAceMatch(hit: boolean) {
  const { rendered, screenNow } = setUpSession()
  const mission = aceMatchMissionOf(SIKER_TEAM)
  if (mission === null) throw new Error('싸이커 공략 레코드가 없다')

  act(() => {
    rendered.result.current.session.actions.beginAceMatch(mission, {
      resultEvents: [WIN_EVENT_ID, LOSE_EVENT_ID],
      context: '장소',
      carried: { ...EMPTY_STORY_CARRY, viewedEventIds: [112] },
    })
  })
  const afterStart = screenNow()

  act(() => {
    rendered.result.current.session.handleMissionPitch({
      resolution: hit ? { kind: '타구', outcome: { kind: '안타', bases: 1 } } : { kind: '스트라이크', isSwinging: true },
      hasSwung: true,
      isBunt: false,
      resultCode: null,
    })
  })
  // 삼진은 세 번 휘둘러야 난다 — 안타가 아니면 두 번 더 채운다
  if (!hit) {
    for (let count = 0; count < 2; count += 1) {
      act(() => {
        rendered.result.current.session.handleMissionPitch({
          resolution: { kind: '스트라이크', isSwinging: true },
          hasSwung: true,
          isBunt: false,
          resultCode: null,
        })
      })
    }
  }
  const status = rendered.result.current.session.missionRun?.status

  act(() => {
    rendered.result.current.session.actions.finishAceMatch()
  })

  rendered.unmount()
  return { afterStart, status, afterFinish: screenNow() }
}

describe('마선수 대결 화면 전환', () => {
  it('match 명령을 받으면 공략 레코드로 대결 화면을 연다', () => {
    const { afterStart } = playAceMatch(true)

    expect(afterStart).toMatchObject({ kind: '마선수대결', resultEvents: [WIN_EVENT_ID, LOSE_EVENT_ID], context: '장소' })
  })

  it('안타를 치면 승리 이벤트 114 로 돌아가고, 대결 전 기록을 함께 들고 간다', () => {
    const { status, afterFinish } = playAceMatch(true)

    expect(status, `대결 결과가 성공이 아니다: ${status}`).toBe('성공')
    expect(afterFinish).toMatchObject({ kind: '이벤트', eventId: WIN_EVENT_ID, context: '장소' })
    expect(afterFinish.kind === '이벤트' ? afterFinish.carried?.viewedEventIds : null).toEqual([112])
  })

  it('삼진이면 패배 이벤트 115 로 돌아간다 — 승리 경로와 같은 번호로 새지 않는다', () => {
    const { status, afterFinish } = playAceMatch(false)

    expect(status, `대결 결과가 실패가 아니다: ${status}`).toBe('실패')
    expect(afterFinish).toMatchObject({ kind: '이벤트', eventId: LOSE_EVENT_ID })
  })
})
