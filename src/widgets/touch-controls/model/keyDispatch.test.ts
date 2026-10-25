// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startTouchKeyPress, touchKeyOf } from '@/widgets/touch-controls/model/keyDispatch'
import { inputTimeOf } from '@/shared/lib/sceneKeyLatch/shownSceneTicks'

afterEach(() => vi.restoreAllMocks())

describe('터치 버튼 키 — 손가락 시각을 붙인다 (r211)', () => {
  it('keydown · keyup 의 사건 시각은 손잡이가 돈 때가 아니라 pointer 사건의 시각이다', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000)
    const 시각: Record<string, number> = {}
    const listener = (event: KeyboardEvent) => {
      시각[event.type] = inputTimeOf(event)
    }
    window.addEventListener('keydown', listener)
    window.addEventListener('keyup', listener)
    const press = startTouchKeyPress(touchKeyOf('5'), document, 940)
    press.release(980)
    window.removeEventListener('keydown', listener)
    window.removeEventListener('keyup', listener)
    expect(시각).toEqual({ keydown: 940, keyup: 980 })
  })

  it('시각을 안 주면 지금 시각', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000)
    let 받은: number | null = null
    const listener = (event: KeyboardEvent) => {
      받은 = inputTimeOf(event)
    }
    window.addEventListener('keydown', listener)
    startTouchKeyPress(touchKeyOf('5')).release()
    window.removeEventListener('keydown', listener)
    expect(받은).toBe(1000)
  })
})
