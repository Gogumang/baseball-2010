// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { SubstitutionSceneOverlay } from '@/features/play-game/ui/SubstitutionSceneOverlay'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

beforeEach(() => {
  vi.useFakeTimers()
  // jsdom 은 캔버스 그리기가 없다 — 컷인은 그림 칸만 본다
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function 그림(n: number) {
  act(() => {
    vi.advanceTimersByTime(n * millisecondsPerFrame())
  })
}

describe('교체 연출 0x16 — "CHANGE" 와 마선수 등장 컷인 0x473f0 (0x4da30 4dafa)', () => {
  it('마선수가 아니면 "CHANGE" 17 그림 끝 비트에서 끝난다 (4daf0)', () => {
    const onDone = vi.fn()
    const { queryByTestId } = render(<SubstitutionSceneOverlay onDone={onDone} />)
    expect(queryByTestId('마선수컷인')).toBeNull()
    그림(16)
    expect(onDone).not.toHaveBeenCalled()
    그림(1)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('마선수면 "CHANGE" 위에 컷인을 그리고, 컷인이 단계 22 에 메시지 13 을 보내는 27 번째 그림 뒤에 끝난다', () => {
    const onDone = vi.fn()
    const { getByTestId } = render(<SubstitutionSceneOverlay aceSlot={1} onDone={onDone} />)
    expect(getByTestId('마선수컷인').getAttribute('data-draw')).toBe('0')
    그림(17)
    expect(onDone).not.toHaveBeenCalled()
    // "CHANGE" 는 마지막 칸(84)에 멈춰 있다
    expect(getByTestId('교체연출').getAttribute('data-frame')).toBe('84')
    expect(getByTestId('마선수컷인').getAttribute('data-draw')).toBe('17')
    그림(9)
    expect(onDone).not.toHaveBeenCalled()
    그림(1)
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
