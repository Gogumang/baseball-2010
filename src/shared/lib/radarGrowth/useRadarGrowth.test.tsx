// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { useRadarGrowth } from '@/shared/lib/radarGrowth/useRadarGrowth'
import { radarObject } from '@/shared/lib/radarGrowth/radarGrowth'

function Probe({ targets, cursor, fromZero, restartFromZero }: {
  readonly targets: readonly number[]
  readonly cursor?: number
  readonly fromZero?: boolean
  readonly restartFromZero?: boolean
}) {
  const current = useRadarGrowth(targets, {
    ...(cursor === undefined ? {} : { restartKey: cursor }),
    ...(fromZero === undefined ? {} : { fromZero }),
    ...(restartFromZero === undefined ? {} : { restartFromZero }),
  })
  return <output data-testid="current">{current.join(',')}</output>
}

const advance = (draws: number) => act(() => {
  vi.advanceTimersByTime(millisecondsPerFrame() * draws)
})
const current = () => screen.getByTestId('current').textContent

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  radarObject.previous = []
  radarObject.hasPrevious = false
})

describe('useRadarGrowth — 목록 0x63b14 의 커서 이동 다시 만들기 (커서 +0x25 → [anim+0x1e3] = 0)', () => {
  it('커서가 움직인 그림에서 지난 목표값부터 오르내린다 — 같은 값의 칸으로 옮겨도 다시 만든다', () => {
    vi.useFakeTimers()
    const { rerender } = render(<Probe targets={[500, 500, 500, 500]} cursor={0} />)
    expect(current()).toBe('48,48,48,48')
    advance(20)
    expect(current()).toBe('500,500,500,500')
    // 다음 팀 — 지난 목표값 500 에서 한 걸음
    rerender(<Probe targets={[600, 400, 500, 500]} cursor={1} />)
    expect(current()).toBe('548,452,500,500')
  })

  it('잠긴 팀(네 값 0)은 지난 값에서 48 씩 줄어든다', () => {
    vi.useFakeTimers()
    const { rerender } = render(<Probe targets={[100, 100, 100, 100]} cursor={0} />)
    advance(5)
    rerender(<Probe targets={[0, 0, 0, 0]} cursor={10} />)
    expect(current()).toBe('52,52,52,52')
  })

  it('fromZero 가 거짓이면 레이더 객체의 지난 목표값에서 이어 간다 — 다 자란 그대로', () => {
    vi.useFakeTimers()
    radarObject.previous = [300, 300, 300, 300]
    radarObject.hasPrevious = true
    render(<Probe targets={[300, 300, 300, 300]} fromZero={false} />)
    expect(current()).toBe('300,300,300,300')
  })
})

describe('useRadarGrowth — 나리 102 등록 키 0x16f28 (타입 · 포지션 줄 좌우 → +0xad = 0 · +0x1e3 = 0)', () => {
  it('다시 건 그림에서 0 부터 48 씩 자란다 — 값이 안 바뀌어도', () => {
    vi.useFakeTimers()
    const { rerender } = render(<Probe targets={[300, 300, 300, 300]} cursor={0} restartFromZero />)
    advance(10)
    expect(current()).toBe('300,300,300,300')
    rerender(<Probe targets={[300, 300, 300, 300]} cursor={1} restartFromZero />)
    expect(current()).toBe('48,48,48,48')
  })
})
