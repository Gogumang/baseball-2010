// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { DefenseScreen } from '@/pages/defense/ui/DefenseScreen'
import {
  DEFENSE_BACKGROUND_WIDTH,
  FIELDER_ACTION,
  RUNNER_ACTION,
  type DefenseViewState,
} from '@/pages/defense/lib/defenseView'

/**
 * 수비 화면 (R3-field-view 1~6절).
 * 진입 때 카메라가 대상에 즉시 맞으므로(vt10 0x466d0), 멈춘 채 띄우면
 * 배치가 카메라 순수 함수 값 그대로다 — 여기서 확인하는 것이 그 배치다.
 */

afterEach(cleanup)

/** 투수판 (20000, 24500) 을 보는 스냅샷 — 카메라는 (12259, 11700), 오프셋은 (−190, −180) */
const 기본_상태: DefenseViewState = {
  ball: { x: 20000, z: 24500, height: 0, isFlying: true },
  fielders: [{ slot: 0, x: 20000, z: 24500, action: FIELDER_ACTION.stand, actionTick: 0 }],
  runners: [],
}

const 띄우기 = (state: DefenseViewState = 기본_상태) =>
  render(<DefenseScreen state={state} isRunning={false} />)

describe('수비 배경', () => {
  it('310 폭 두 장으로 620×500 을 만든다 — 오른쪽은 좌우 반전이다', () => {
    띄우기()
    const left = screen.getByTestId('defense-background-left')
    const right = screen.getByTestId('defense-background-right')

    expect(left.style.left).toBe('-190px')
    expect(left.style.top).toBe('-180px')
    expect(left.style.width).toBe(`${DEFENSE_BACKGROUND_WIDTH}px`)
    expect(right.style.left).toBe(`${-190 + DEFENSE_BACKGROUND_WIDTH}px`)
    expect(right.className).not.toBe(left.className)
  })
})

describe('월드 좌표 → 화면 좌표', () => {
  it('카메라가 보는 점은 화면 가로 한가운데(120)에 온다', () => {
    띄우기()
    const pitcher = screen.getByTestId('defense-fielder-0')

    expect(pitcher.style.left).toBe('120px')
    expect(pitcher.style.top).toBe('196px')
  })

  it('1루 쪽(x 큰 쪽) 야수는 오른쪽에 놓인다', () => {
    띄우기({
      ...기본_상태,
      fielders: [
        ...기본_상태.fielders,
        { slot: 2, x: 25068, z: 23275, action: FIELDER_ACTION.runRight, actionTick: 1 },
      ],
    })

    const first = screen.getByTestId('defense-fielder-2')
    expect(Number.parseInt(first.style.left, 10)).toBeGreaterThan(120)
    // 달리기 → 동작 4 · 칸 1 = vt40 날값 10 에 +17 한 프레임 27 (R3 2-1 · S12 8-1)
    expect(first.dataset.frame).toBe('27')
  })

  it('공은 높이만큼 위로 올라가고 그림자는 바닥에 남는다', () => {
    띄우기({ ...기본_상태, ball: { x: 20000, z: 24500, height: 6500, isFlying: true } })

    const ball = screen.getByTestId('defense-ball')
    const shadow = screen.getByTestId('defense-ball-shadow')
    // 6500 월드 = 6500 × 500 / 32500 = 100px
    expect(Number.parseInt(shadow.style.top, 10) - Number.parseInt(ball.style.top, 10)).toBe(100)
  })
})

describe('주자와 번쩍임', () => {
  it('주자는 동작 표대로 그리고, 안 보이는 주자는 빠진다', () => {
    띄우기({
      ...기본_상태,
      runners: [
        { index: 0, x: 22000, z: 26000, action: RUNNER_ACTION.slide, actionTick: 0, base: 1, isAdvancing: true },
        { index: 1, x: 25946, z: 24500, action: RUNNER_ACTION.run, actionTick: 0, base: 1, isAdvancing: true, isVisible: false },
      ],
    })

    // 슬라이딩 · 루 1 · 진루 → 13 + 표[1] = 16 (R3 8-1)
    expect(screen.getByTestId('defense-runner-0').dataset.frame).toBe('16')
    expect(screen.queryByTestId('defense-runner-1')).toBeNull()
  })

  it('번쩍임 B 는 공보다 50px 위에 놓인다 (R2 2절)', () => {
    띄우기({ ...기본_상태, flash: { kind: 'b', step: 2 } })

    const ball = screen.getByTestId('defense-ball')
    const flash = screen.getByTestId('defense-flash')
    expect(Number.parseInt(flash.style.top, 10)).toBe(Number.parseInt(ball.style.top, 10) - 50)
  })

  it('번쩍임이 없으면 그리지 않는다', () => {
    띄우기()
    expect(screen.queryByTestId('defense-flash')).toBeNull()
  })
})

describe('좌·우 그림 (S12 8절 — 좌우 반전이 아니다)', () => {
  it('야수는 뒤집지 않고 동작 3·4 의 다른 프레임 묶음으로 좌·우를 가른다', () => {
    띄우기({
      ...기본_상태,
      fielders: [
        { slot: 0, x: 20000, z: 24500, action: FIELDER_ACTION.runLeft, actionTick: 0 },
        { slot: 1, x: 20000, z: 29705, action: FIELDER_ACTION.runRight, actionTick: 0 },
      ],
    })

    const 왼 = screen.getByTestId('defense-fielder-0')
    const 오 = screen.getByTestId('defense-fielder-1')
    // 프레임은 vt40 날값 6·9 에 +17 을 더한 23·26 이고, 뒤집기 클래스는 붙지 않는다
    expect(왼.dataset.frame).toBe('23')
    expect(오.dataset.frame).toBe('26')
    expect(왼.className.split(' ')).toHaveLength(1)
    expect(오.className.split(' ')).toEqual(왼.className.split(' '))
  })
})
