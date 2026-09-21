// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { DefensePlayback } from '@/pages/defense/ui/DefensePlayback'
import type { DefenseViewState } from '@/pages/defense/lib/defenseView'

/**
 * 수비 한 플레이 재생 (원본 경기 장면 상태 0x17).
 * 이 화면이 없으면 **배트에 맞은 공이 어디로 갔는지 화면에 아예 안 나온다** —
 * 실제로 팀 경기·투수편이 한동안 그런 상태였다.
 */

afterEach(cleanup)

const 틱 = (): DefenseViewState => ({
  ball: { x: 20_000, z: 24_500, height: 0, isFlying: true },
  fielders: [],
  runners: [],
})

describe('수비 재생', () => {
  it('틱이 없으면 아무것도 그리지 않고 곧바로 끝났다고 알린다', () => {
    const onDone = vi.fn()
    const { container } = render(<DefensePlayback ticks={[]} onDone={onDone} />)

    expect(container.firstChild).toBeNull()
    expect(onDone).toHaveBeenCalled()
  })

  /**
   * ⚠️ jsdom 에서는 `useFrameOrigins` 의 JSON 이 안 와서 `FrameSprite` 가 **아무것도 안 그린다** —
   * 그래서 공 그림 자체는 여기서 확인할 수 없다. 화면이 서는 것까지만 본다.
   */
  it('틱이 있으면 수비 화면을 세운다 — 곧바로 끝났다고 하지 않는다', () => {
    const onDone = vi.fn()
    const { container } = render(<DefensePlayback ticks={[틱(), 틱(), 틱()]} onDone={onDone} />)

    expect(container.firstChild).not.toBeNull()
    expect(onDone).not.toHaveBeenCalled()
  })
})
