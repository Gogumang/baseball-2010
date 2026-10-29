// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import { createPitcherCareer, type PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'

/**
 * 투수편 세션 상태를 atom 으로 옮긴 뒤(r373)에도 한 사건 안의 여러 쓰기는 **한 그림**에 함께 보인다 — 옛 `setState` 묶음과 같다.
 * 중간 그림(커리어만 바뀌고 화면은 아직인 그림 따위)이 끼지 않는지, 저장 차례가 그대로인지 본다.
 */

function 기록저장(log: string[], held: PitcherCareer | null): JsonStorePort {
  let saved: unknown = held
  return {
    load: () => saved,
    save: (value) => {
      saved = value
      const career = value as Partial<PitcherCareer>
      log.push(`저장 ${career.gamesPlayed} ${career.seasonEndState}`)
    },
  }
}

function 띄우기(held: PitcherCareer | null) {
  const log: string[] = []
  const store = 기록저장(log, held)
  const random = createSeededRandom(20100901)
  const rendered = renderHook(() => {
    const session = usePitcherLeagueSession(store, random, false)
    log.push(
      `그림 ${session.scene} ${session.career === null ? '선수없음' : session.career.seasonEndState} ${session.matchAces === null ? '' : '마선수'}`,
    )
    return session
  })
  return { ...rendered, log }
}

const 그림들 = (log: readonly string[]) => log.filter((line) => line.startsWith('그림'))
const 저장들 = (log: readonly string[]) => log.filter((line) => line.startsWith('저장'))

describe('투수편 세션 atom 쓰기 묶음', () => {
  it('등록 — 커리어 · 화면이 한 그림에 서고, 저장은 그 앞 한 번', () => {
    const { result, log } = 띄우기(null)
    log.length = 0

    act(() => result.current.actions.create('묶음', { role: 0, typeIndex: 0, handIndex: 0, skinIndex: 0, breakingPitchSlots: [1, 4] }))

    expect(그림들(log)[0]).toBe('그림 관리 null ')
    expect(저장들(log)).toEqual(['저장 0 null'])
    expect(log.indexOf('저장 0 null')).toBeLessThan(log.indexOf(그림들(log)[0]))
  })

  it('[다음경기] → 109 → 142 — 마선수 · 화면이 한 그림에 바뀐다(마선수만 선 중간 그림이 없다)', () => {
    const { result, log } = 띄우기({ ...createPitcherCareer('묶음'), gamesPlayed: 4, hasSeenYearGoalWindow: true })
    act(() => result.current.actions.openNextGameStandings())
    expect(그림들(log).at(-1)).toBe('그림 다음경기순위 109 ')
    log.length = 0

    act(() => result.current.actions.confirmNextGameStandings())

    expect(그림들(log)[0]).toBe('그림 경기준비 109 마선수')
    expect(저장들(log)).toEqual(['저장 4 109'])
  })

  it('109 취소 — 저장 칸 · 화면이 한 그림에, 저장은 한 번', () => {
    const { result, log } = 띄우기({ ...createPitcherCareer('묶음'), gamesPlayed: 4, hasSeenYearGoalWindow: true })
    act(() => result.current.actions.openNextGameStandings())
    log.length = 0

    act(() => result.current.actions.cancelNextGameStandings())

    expect(그림들(log)[0]).toBe('그림 관리 null ')
    expect(저장들(log)).toEqual(['저장 4 null'])
  })
})
