// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, renderHook } from '@testing-library/react'
import { useStageControls } from '@/widgets/batting-stage/model/useStageControls'
import type { StageActions } from '@/widgets/batting-stage/model/useStageControls'
import type { StageRefs } from '@/widgets/batting-stage/model/stageRefs'
import {
  markCommonWindowShown,
  markGameSceneUp,
  resetCommonWindowShownForTest,
} from '@/shared/lib/commonWindow/commonWindow'

afterEach(cleanup)

/** 이 고리가 실제로 읽는 칸만 채운 가짜 ref 묶음 */
const 가짜refs = (canBunt: boolean): StageRefs =>
  ({
    pointerDownAtRef: { current: 0 },
    latestRef: { current: { canBunt } },
  }) as unknown as StageRefs

const 붙이기 = (actions: Partial<StageActions>, canBunt = true) => {
  const 손잡이: StageActions = {
    swing: vi.fn(),
    pressBunt: vi.fn(),
    releaseBunt: vi.fn(),
    moveBatter: vi.fn(),
    ...actions,
  }
  renderHook(() => useStageControls(가짜refs(canBunt), 손잡이))
  return 손잡이
}

describe('타석 키 배치 (0x53670 · 0x535a4)', () => {
  it("'0' 이 필살타법을 부른다 (메시지 0x6a6)", () => {
    const specialSwing = vi.fn()
    붙이기({ specialSwing })

    fireEvent.keyDown(window, { key: '0' })

    expect(specialSwing).toHaveBeenCalledTimes(1)
  })

  it("'0' 은 스윙도 번트도 아니다", () => {
    const 손잡이 = 붙이기({ specialSwing: vi.fn() })

    fireEvent.keyDown(window, { key: '0' })

    expect(손잡이.swing).not.toHaveBeenCalled()
    expect(손잡이.pressBunt).not.toHaveBeenCalled()
  })

  it('화면이 필살타법 손잡이를 안 넘기면 아무 일도 없다', () => {
    const 손잡이 = 붙이기({})

    fireEvent.keyDown(window, { key: '0' })

    expect(손잡이.swing).not.toHaveBeenCalled()
    expect(손잡이.pressBunt).not.toHaveBeenCalled()
  })

  it('나머지 키는 그대로다 — 5 스윙 · 4/6 이동 · 8 번트', () => {
    const 손잡이 = 붙이기({ specialSwing: vi.fn() })

    fireEvent.keyDown(window, { key: '5' })
    fireEvent.keyDown(window, { key: '4' })
    fireEvent.keyDown(window, { key: '6' })
    fireEvent.keyDown(window, { key: '8' })

    expect(손잡이.swing).toHaveBeenCalledTimes(1)
    expect(손잡이.moveBatter).toHaveBeenNthCalledWith(1, -1)
    expect(손잡이.moveBatter).toHaveBeenNthCalledWith(2, 1)
    expect(손잡이.pressBunt).toHaveBeenCalledTimes(1)
  })
})

describe('번트는 누르고 있는 동안만 — 뗄 때 0x5364c → 0x6a8 (0xbca04 비트 9)', () => {
  it("'7'~'9' 를 떼면 푼다 — 종류를 가리지 않는다", () => {
    const 손잡이 = 붙이기({})

    fireEvent.keyDown(window, { key: '7' })
    expect(손잡이.pressBunt).toHaveBeenCalledWith(2, expect.any(Number))
    fireEvent.keyUp(window, { key: '9' })
    expect(손잡이.releaseBunt).toHaveBeenCalledTimes(1)
  })

  it('번트 키를 다시 눌러도 끄지 않는다 — 누름은 늘 누름이다', () => {
    const 손잡이 = 붙이기({})

    fireEvent.keyDown(window, { key: '8' })
    fireEvent.keyDown(window, { key: '8' })
    expect(손잡이.pressBunt).toHaveBeenCalledTimes(2)
    expect(손잡이.releaseBunt).not.toHaveBeenCalled()
  })

  it('다른 키를 떼면 아무 일도 없다', () => {
    const 손잡이 = 붙이기({})

    fireEvent.keyUp(window, { key: '5' })
    expect(손잡이.releaseBunt).not.toHaveBeenCalled()
  })
})

describe('공용 창이 서 있는 동안 (경기 장면 0x52c50 의 52cc6 — 키 처리 0x498d4 를 건너뛴다)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    resetCommonWindowShownForTest()
  })

  it('경기 장면 위에 창이 떠 있으면 스윙 · 이동 · 번트 키를 안 받는다', () => {
    const 장면 = markGameSceneUp()
    const 창 = markCommonWindowShown()
    const 손잡이 = 붙이기({ specialSwing: vi.fn() })

    for (const key of ['5', '4', '6', '8', '0']) fireEvent.keyDown(window, { key })

    expect(손잡이.swing).not.toHaveBeenCalled()
    expect(손잡이.moveBatter).not.toHaveBeenCalled()
    expect(손잡이.pressBunt).not.toHaveBeenCalled()
    expect(손잡이.specialSwing).not.toHaveBeenCalled()
    창()
    fireEvent.keyDown(window, { key: '5' })
    expect(손잡이.swing).toHaveBeenCalledTimes(1)
    장면()
  })

  it('창이 닫힌 뒤 키 시각은 경기 장면 시계다 — 창이 떠 있던 만큼 빠진다(단계 시작 시각과 같은 시계)', () => {
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(1000)
    const 장면 = markGameSceneUp()
    const 창 = markCommonWindowShown()
    now.mockReturnValue(4000)
    창()
    now.mockReturnValue(4500)
    const 손잡이 = 붙이기({})
    fireEvent.keyDown(window, { key: '5' })
    expect(손잡이.swing).toHaveBeenCalledWith(1500)
    장면()
  })
})
