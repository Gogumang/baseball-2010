// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { DefensePlayback } from '@/pages/defense/ui/DefensePlayback'
import type { DefenseViewState } from '@/pages/defense/lib/defenseView'

/**
 * 수비 한 플레이 재생. 원본은 상태 0x17 루프가 공이 멈출 때까지 돌지만(R10),
 * 웹은 진행기가 계산해 둔 틱을 순서대로 보여 주기만 한다.
 */

afterEach(cleanup)

const 틱 = (x: number): DefenseViewState => ({
  ball: { x, z: 20000, height: 0, isFlying: false },
  fielders: [],
  runners: [],
})

describe('수비 재생', () => {
  it('틱이 없으면 아무것도 그리지 않고 바로 끝난다', () => {
    const onDone = vi.fn()
    const { container } = render(<DefensePlayback ticks={[]} onDone={onDone} />)

    expect(container.firstChild).toBeNull()
    expect(onDone).toHaveBeenCalled()
  })

  it('첫 틱부터 그린다', () => {
    const { container } = render(<DefensePlayback ticks={[틱(20000), 틱(21000)]} onDone={vi.fn()} />)

    // 수비 화면이 떴는지만 본다 — 그림이 하나라도 놓였으면 된다
    expect(container.querySelectorAll('img').length).toBeGreaterThan(0)
  })

  it('마지막 틱까지 보여 준 뒤 멈춰 두는 시간이 지나야 끝난다', () => {
    const onDone = vi.fn()
    // holdUpdates 를 0 으로 두면 마지막 틱에 닿는 즉시 끝난다
    render(<DefensePlayback ticks={[틱(20000)]} onDone={onDone} holdUpdates={0} />)

    expect(onDone).toHaveBeenCalled()
  })
})
