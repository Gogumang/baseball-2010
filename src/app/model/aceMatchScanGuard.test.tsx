// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { isAutoScanHeldByAceMatch } from '@/app/model/aceMatchScanGuard'
import { useCareerSession } from '@/app/model/useCareerSession'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import type { Screen } from '@/app/model/screen'
import { createCareer } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { AceMatchHold, AceMatchHoldPort } from '@/entities/mode-save/model/modeSave'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { SaveGamePort } from '@/shared/api/save/saveGamePort'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 대기 = (hold: AceMatchHold): AceMatchHoldPort => ({ read: () => hold, writeResult: () => {} })
const 투수편대기 = 대기({ batter: false, pitcher: true, originalMode: 3 })
const 대기없음 = 대기({ batter: false, pitcher: false, originalMode: 0 })

function 메모리저장(held: PlayerCareer): SaveGamePort {
  let saved: PlayerCareer | null = held
  return {
    load: () => saved,
    save: (career) => {
      saved = career
    },
    clear: () => {
      saved = null
    },
  }
}

/** 오프닝 · 연초를 본 새 선수로 이어하기 → 105 진입 — 자동 훑기(0x1cf9c)가 trigger 0 첫 이벤트를 찾는 판 */
const 띄우기 = (aceMatchHold: AceMatchHoldPort) => {
  const saveGame = 메모리저장({ ...createCareer('가드'), seenEventIds: ['451'], hasSeenYearGoalWindow: true })
  const random = createSeededRandom(20100901)
  const rendered = renderHook(() => {
    const [screen, setScreen] = useState<Screen>({ kind: '메인메뉴' })
    const runner = useAtBatRunner()
    return { screen, setScreen, session: useCareerSession({ runner, random, saveGame, screen, setScreen, aceMatchHold }) }
  })
  act(() => rendered.result.current.session.actions.continueSaved())
  return rendered
}

describe('자동 훑기 0x1cf9c 의 대결 대기 가드 1cfe4~1d008 (B-124)', () => {
  it('원본 길: 대기 칸 둘 중 하나라도 서 있으면 건너뛴다 — 모드를 안 본다', () => {
    expect(isAutoScanHeldByAceMatch(투수편대기)).toBe(true)
    expect(isAutoScanHeldByAceMatch(대기({ batter: true, pitcher: false, originalMode: 4 }))).toBe(true)
    expect(isAutoScanHeldByAceMatch(대기없음)).toBe(false)
    expect(isAutoScanHeldByAceMatch(undefined)).toBe(false)
  })

  it('고친 길: 다른 편 대기는 보지 않는다 (제 편 대기는 105 진입이 먼저 140 으로 보낸다)', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-124']))
    expect(isAutoScanHeldByAceMatch(투수편대기)).toBe(false)
  })

  it('원본 길: 투수편 대결 대기가 남아 있으면 타자편 105 에 들어와도 자동 이벤트가 안 선다', async () => {
    const rendered = 띄우기(투수편대기)
    await waitFor(() => expect(rendered.result.current.session.storyEvents).not.toBeNull(), { timeout: 5000 })
    // 대기가 없으면 같은 판에서 trigger 0 이벤트가 선다(아래) — 가드가 막아 관리 화면에 머문다
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(rendered.result.current.screen).toEqual({ kind: '관리' })
  })

  it('대기가 없으면 같은 판에서 자동 이벤트가 선다', async () => {
    const rendered = 띄우기(대기없음)
    await waitFor(() => expect(rendered.result.current.session.storyEvents).not.toBeNull(), { timeout: 5000 })
    await waitFor(() => expect(rendered.result.current.screen).toMatchObject({ kind: '이벤트', context: '관리' }))
  })

  it('고친 길: 투수편 대기가 남아 있어도 타자편 자동 이벤트가 선다', async () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-124']))
    const rendered = 띄우기(투수편대기)
    await waitFor(() => expect(rendered.result.current.session.storyEvents).not.toBeNull(), { timeout: 5000 })
    await waitFor(() => expect(rendered.result.current.screen).toMatchObject({ kind: '이벤트', context: '관리' }))
  })
})
