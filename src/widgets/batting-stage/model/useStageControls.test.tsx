// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, renderHook } from '@testing-library/react'
import { useStageControls } from '@/widgets/batting-stage/model/useStageControls'
import type { StageActions } from '@/widgets/batting-stage/model/useStageControls'
import type { StageRefs } from '@/widgets/batting-stage/model/stageRefs'

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
    toggleBunt: vi.fn(),
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
    expect(손잡이.toggleBunt).not.toHaveBeenCalled()
  })

  it('화면이 필살타법 손잡이를 안 넘기면 아무 일도 없다', () => {
    const 손잡이 = 붙이기({})

    fireEvent.keyDown(window, { key: '0' })

    expect(손잡이.swing).not.toHaveBeenCalled()
    expect(손잡이.toggleBunt).not.toHaveBeenCalled()
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
    expect(손잡이.toggleBunt).toHaveBeenCalledTimes(1)
  })
})
