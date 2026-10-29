// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useSeasonSession } from '@/app/model/useSeasonSession'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'

/**
 * 세션 상태를 atom 으로 옮긴 뒤(r370)에도 한 사건 안의 여러 쓰기는 **한 그림**에 함께 보인다 — 옛 `setState` 묶음과 같다.
 * 중간 그림(장면만 바뀌고 경기 옵션은 아직 없는 그림 따위)이 끼지 않는지, 저장 차례가 그대로인지 본다.
 */

function 기록저장(log: string[]): JsonStorePort {
  let held: unknown = null
  return {
    load: () => held,
    save: (value: object) => {
      held = value
      log.push('저장')
    },
  }
}

function 띄우기() {
  const log: string[] = []
  const store = 기록저장(log)
  const rendered = renderHook(() => {
    const session = useSeasonSession(store, createSeededRandom(20100901))
    log.push(`그림 ${session.scene} ${session.gameOptions === null ? '옵션없음' : '옵션'} ${session.pendingGame === null ? '대기없음' : '대기'}`)
    return session
  })
  return { ...rendered, log }
}

describe('시즌 세션 atom 쓰기 묶음', () => {
  it('팀 고르기 — 저장 뒤 한 그림에 새 시즌과 관리 메뉴가 함께 선다', () => {
    const { result, log } = 띄우기()
    log.length = 0

    act(() => result.current.actions.chooseTeam(0, '테스터'))

    expect(log[0]).toBe('저장')
    expect(log[1]).toBe(`그림 ${SEASON_SCENE_STATE.관리메뉴} 옵션없음 대기없음`)
    expect(result.current.state?.record.teamId).toBe(0)
  })

  it('경기 바로 열기 — 장면 · 경기 옵션이 한 그림에 바뀐다(장면만 바뀐 중간 그림이 없다)', () => {
    const { result, log } = 띄우기()
    act(() => result.current.actions.chooseTeam(0, '테스터'))
    act(() => result.current.actions.goto(SEASON_SCENE_STATE.관리메뉴))
    log.length = 0

    act(() => result.current.actions.playNextGame())

    const 그림 = log.filter((line) => line.startsWith('그림'))
    expect(그림[0]).toBe(`그림 ${SEASON_SCENE_STATE.경기직전} 옵션 대기없음`)
    expect(log.indexOf('저장')).toBeLessThan(log.indexOf(그림[0]))
  })

  it('한 사건에 여러 액션을 불러도 그림은 끝 값 하나다', () => {
    const { result, log } = 띄우기()
    act(() => result.current.actions.chooseTeam(0, '테스터'))
    const 그림수 = () => log.filter((line) => line.startsWith('그림')).length
    const 앞 = 그림수()

    act(() => {
      result.current.actions.toggleMatchSettings()
      result.current.actions.moveMenuCursor('management', 2)
      result.current.actions.toggleMatchSettings()
      result.current.actions.moveMenuCursor('management', 3)
    })

    expect(그림수()).toBe(앞 + 1)
    expect(result.current.isMatchSettingsOpen).toBe(false)
    expect(result.current.menuCursors.management).toBe(3)
  })
})
