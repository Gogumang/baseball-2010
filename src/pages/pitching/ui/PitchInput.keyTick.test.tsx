// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { gameSceneTickNow } from '@/shared/lib/commonWindow/commonWindow'
import { gameSceneShownTicks } from '@/shared/lib/sceneKeyLatch/shownSceneTicks'
import { PitchGradeGauge } from '@/pages/pitching/ui/PitchGradeGauge'
import { AimCursor } from '@/pages/pitching/ui/AimCursor'
import { ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'

/**
 * **투수편 입력 키(게이지 · 조준 확정)는 누를 때 화면에 있던 그림으로 센다** (r217).
 *
 * **게이지 OK 는 누를 때 화면에 있던 그림의 커서로 칸을 정한다** (r217 — r211 의 타석 키와 같은 웹판 전용 지연).
 *
 * 원본은 키를 받은 틀 = 마지막으로 그린 틀이고, 다음 틀 머리의 0x50e08 이 그 그림까지 오른 커서 `+0x17bc` 로 칸을 정한다. 웹은 커서를
 * 틱 시계로 올리고 그림은 투수편 장면(`PitcherSideStage`)이 rAF 로 그린다 — 그리기가 밀리면(느린 기기 · 30Hz 절전) 커서는 이미 다음 칸인데
 * 화면은 앞 칸이다. 손잡이 때의 지금 틱 · 지금 커서로 정하면 본 칸보다 한 칸 뒤가 된다. 장면이 적는 그림 기록(`gameSceneShownTicks`)으로
 * 본 그림을 찾고, 그 그림의 커서로 정한다.
 */
beforeEach(() => {
  vi.useFakeTimers()
  gameSceneShownTicks.clear()
})
afterEach(() => {
  cleanup()
  gameSceneShownTicks.clear()
  vi.useRealTimers()
})

const 한틱 = millisecondsPerFrame()
const 흘림 = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
/** 장면이 지금 틱 그림을 그렸다 */
const 그림 = () => gameSceneShownTicks.mark(gameSceneTickNow(), performance.now())
/** 틱마다 그림이 서는 틀 `n` 개 */
const 틀 = (n: number) => {
  for (let index = 0; index < n; index += 1) {
    흘림(한틱)
    그림()
  }
}
/** 키 사건 — `pressedAt` 을 주면 사건 시각(`timeStamp`)이 그때다 */
const 키 = (key: string, pressedAt?: number) => {
  const event = new KeyboardEvent('keydown', { key })
  if (pressedAt !== undefined) Object.defineProperty(event, 'timeStamp', { value: pressedAt })
  act(() => void window.dispatchEvent(event))
}
const 칸 = () => Number(/투구 게이지 (\d+)칸/.exec(screen.getByRole('button').getAttribute('aria-label') ?? '')?.[1])

describe('게이지 OK — 그리기가 밀려도 사람이 본 그림의 커서로 정한다 (r217)', () => {
  it('다음 그림이 1.6 틱 동안 안 올 때 누르면 — 정한 칸은 화면에 있던 커서', () => {
    const onRelease = vi.fn()
    render(<PitchGradeGauge onRelease={onRelease} />)
    // 부품이 선 다음 틀 머리가 0x11 틱 0 — 넷째 그림까지 그렸다
    틀(4)
    const 본칸 = 칸()
    expect(본칸).toBeGreaterThan(0)
    // 그리기가 밀린다 — 커서는 틱 시계로 한 칸 더 올랐지만 화면은 앞 그림이다
    흘림(한틱 * 1.6)
    expect(칸()).toBe(본칸 + 1)
    키('5')
    틀(1)
    expect(칸()).toBe(본칸)
    틀(10)
    expect(onRelease.mock.calls).toEqual([[본칸]])
  })

  it('누른 뒤 손잡이가 새 그림보다 늦게 돌아도 — 누를 때 보이던 그림의 커서', () => {
    const onRelease = vi.fn()
    render(<PitchGradeGauge onRelease={onRelease} />)
    틀(3)
    const 본칸 = 칸()
    const 누른때 = performance.now() + 1
    // 키 사건이 줄에 선 사이 다음 그림(한 칸 뒤)이 먼저 섰다
    틀(1)
    expect(칸()).toBe(본칸 + 1)
    흘림(3)
    키('Enter', 누른때)
    틀(1)
    expect(칸()).toBe(본칸)
    틀(10)
    expect(onRelease.mock.calls).toEqual([[본칸]])
  })

  it('그림 기록이 없으면(장면 없이 선 게이지) 예전처럼 지금 커서', () => {
    const onRelease = vi.fn()
    render(<PitchGradeGauge onRelease={onRelease} />)
    흘림(한틱 * 4)
    const 지금칸 = 칸()
    키('5')
    흘림(한틱)
    expect(칸()).toBe(지금칸)
  })
})

/**
 * **조준 OK 는 누를 때 본 그림의 조준점에서 한 번 더 지나 넘긴다** (r217). 원본은 다음 틀 머리의 0x50e9c 가 방향을 지우고 그 틀의 0x39c5c 를
 * 한 번 더 지난다 — 조준점은 본 그림의 자리다. 웹은 그리기 · 손잡이가 밀린 사이 갱신이 조준점을 더 흘렸다.
 */
describe('조준 OK — 그리기가 밀려도 본 그림의 조준점으로 확정한다 (r217)', () => {
  const C = ZONE_CENTERS[1]

  it('방향으로 흐르는 중 다음 그림이 1.6 틱 동안 안 올 때 OK — 본 그림의 자리', () => {
    const onConfirm = vi.fn()
    render(<AimCursor side={1} onConfirm={onConfirm} />)
    키('6')
    // 조준점이 오른쪽으로 두 번 흘렀다(x + 40) — 그 그림을 보고 있다
    틀(2)
    흘림(한틱 * 1.6)
    키('5')
    틀(1)
    expect(onConfirm.mock.calls).toEqual([[{ x: C.x + 40, y: C.y, z: C.z }]])
  })

  it('누른 뒤 손잡이가 새 그림보다 늦게 돌아도 — 누를 때 보이던 자리', () => {
    const onConfirm = vi.fn()
    render(<AimCursor side={1} onConfirm={onConfirm} />)
    키('6')
    틀(2)
    const 누른때 = performance.now() + 1
    틀(1)
    흘림(3)
    키('Enter', 누른때)
    틀(1)
    expect(onConfirm.mock.calls).toEqual([[{ x: C.x + 40, y: C.y, z: C.z }]])
  })

  it('그림이 제때 서면 예전과 같다 — 그 틱까지 돈 자리', () => {
    const onConfirm = vi.fn()
    render(<AimCursor side={1} onConfirm={onConfirm} />)
    키('6')
    틀(2)
    키('5')
    틀(1)
    expect(onConfirm.mock.calls).toEqual([[{ x: C.x + 40, y: C.y, z: C.z }]])
  })
})
