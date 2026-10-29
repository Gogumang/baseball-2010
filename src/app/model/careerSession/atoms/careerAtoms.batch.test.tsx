// @vitest-environment happy-dom
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCareerSession } from '@/app/model/useCareerSession'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import type { Screen } from '@/app/model/screen'
import { createCareer, type PlayerCareer } from '@/entities/career/model/playerCareer'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { SaveGamePort } from '@/shared/api/save/saveGamePort'

/**
 * 커리어 세션 상태를 atom 으로 옮긴 뒤(r372)에도 한 사건 안의 여러 쓰기는 **한 그림**에 함께 보인다 — 옛 `setState` 묶음과 같다.
 * 중간 그림(커리어만 바뀌고 화면 · 알림은 아직인 그림 따위)이 끼지 않는지, 저장 차례가 그대로인지 본다.
 */

function 기록저장(log: string[], held: PlayerCareer | null): SaveGamePort {
  let saved = held
  return {
    load: () => saved,
    save: (career) => {
      saved = career
      log.push(`저장 ${career.gamesPlayed} ${career.seasonEndState}`)
    },
    clear: () => {
      saved = null
      log.push('지움')
    },
  }
}

function 띄우기(held: PlayerCareer | null) {
  const log: string[] = []
  const saveGame = 기록저장(log, held)
  const random = createSeededRandom(20100901)
  const rendered = renderHook(() => {
    const [screen, setScreen] = useState<Screen>({ kind: '메인메뉴' })
    const runner = useAtBatRunner()
    const session = useCareerSession({ runner, random, saveGame, screen, setScreen })
    const detail = session.managementDetail === null ? '창없음' : '창'
    log.push(
      `그림 ${screen.kind} ${session.career === null ? '선수없음' : session.career.seasonEndState} ${detail} ${session.matchAces === null ? '' : '마선수'}`,
    )
    return { screen, session }
  })
  return { ...rendered, log }
}

const 그림들 = (log: readonly string[]) => log.filter((line) => line.startsWith('그림'))

describe('커리어 세션 atom 쓰기 묶음', () => {
  it('이어하기 — 커리어 · 화면이 한 그림에 서고, 저장은 그 그림 뒤 한 번', () => {
    const { result, log } = 띄우기({ ...createCareer('묶음'), gamesPlayed: 4 })
    log.length = 0

    act(() => result.current.session.actions.continueSaved())

    expect(그림들(log)[0]).toBe('그림 관리 null 창없음 ')
    expect(log.indexOf('저장 4 null')).toBeGreaterThan(log.indexOf(그림들(log)[0]))
    expect(log.filter((line) => line.startsWith('저장'))).toHaveLength(1)
  })

  it('[다음경기] → 109 → 142 — 마선수 · 순위 저장 · 화면이 한 그림에 바뀐다(마선수만 선 중간 그림이 없다)', () => {
    const { result, log } = 띄우기({ ...createCareer('묶음'), gamesPlayed: 4 })
    act(() => result.current.session.actions.continueSaved())
    act(() => result.current.session.actions.runCommand('다음경기'))
    expect(그림들(log).at(-1)).toBe('그림 다음경기순위 109 창없음 ')
    log.length = 0

    act(() => result.current.session.actions.confirmNextGameStandings())

    expect(그림들(log)[0]).toBe('그림 경기준비 109 창없음 마선수')
    expect(result.current.screen.kind).toBe('경기준비')
  })

  it('휴식 — 커리어 · 결과 창이 한 그림에, 창을 닫으면 회복과 105 다시 들어옴이 한 그림에', () => {
    const { result, log } = 띄우기({ ...createCareer('묶음'), gamesPlayed: 4, morale: 10 })
    act(() => result.current.session.actions.continueSaved())
    log.length = 0

    act(() => result.current.session.actions.runCommand('휴식'))
    expect(그림들(log)[0]).toBe('그림 관리 null 창 ')
    const 앞 = 그림들(log).length

    act(() => result.current.session.actions.closeManagementDetail())
    expect(그림들(log)[앞]).toBe('그림 관리 null 창없음 ')
    expect(result.current.session.managementDetail).toBeNull()
  })
})
