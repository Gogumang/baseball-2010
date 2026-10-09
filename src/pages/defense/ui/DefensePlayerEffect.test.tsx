// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { DefenseScreen } from '@/pages/defense/ui/DefenseScreen'
import { FIELDER_ACTION, type DefenseViewState } from '@/pages/defense/lib/defenseView'

const 애니들 = Array.from({ length: 17 }, (_, index) => (index === 13 ? [{ frame: 50, delay: 0 }] : [{ frame: 0, delay: 2 }]))
const 원점들 = Object.fromEntries(
  Array.from({ length: 60 }, (_, frame) => [String(frame).padStart(3, '0'), { x: -4, y: -4, width: 8, height: 8 }]),
)

let 원래_fetch: typeof globalThis.fetch | undefined
beforeEach(() => {
  원래_fetch = globalThis.fetch
  globalThis.fetch = ((url: string) =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(url.endsWith('animations.json') ? 애니들 : 원점들),
    })) as unknown as typeof globalThis.fetch
})
afterEach(() => {
  cleanup()
  if (원래_fetch === undefined) delete (globalThis as { fetch?: unknown }).fetch
  else globalThis.fetch = 원래_fetch
})

const 상태 = (fumbleTicks: number): DefenseViewState => ({
  ball: { x: 20000, z: 24500, height: 0, isFlying: true },
  fielders: [{ slot: 0, x: 20000, z: 24500, action: FIELDER_ACTION.stand, actionTick: 0, fumbleTicks }],
  runners: [],
})

describe('player_effect 부착 효과 (0x43278)', () => {
  it('펌블 표시가 서 있으면 야수 화면점에서 40 위에 "!"(애니 13 = 프레임 50)를 야수 그림 뒤에 그린다', async () => {
    render(<DefenseScreen state={상태(6)} isRunning={false} />)
    await act(async () => {})
    const alert = screen.getByTestId('수비-효과-f0-alert')
    expect(alert.style.left).toBe('120px')
    expect(alert.style.top).toBe(`${196 - 40}px`)
    expect(alert.getAttribute('data-frame')).toBe('50')
    const fielder = screen.getByTestId('defense-fielder-0')
    expect(fielder.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('표시가 0 이면 안 그린다', async () => {
    render(<DefenseScreen state={상태(0)} isRunning={false} />)
    await act(async () => {})
    expect(screen.queryByTestId('수비-효과-f0-alert')).toBeNull()
  })
})

describe('마선수 주자 그림 (0x79d10)', () => {
  const 주자상태 = (isAce: boolean, runnerAceSprite: number | null): DefenseViewState => ({
    ball: { x: 20000, z: 24500, height: 0, isFlying: true },
    fielders: [],
    runners: [{ index: 1, x: 20000, z: 24500, action: 0, actionTick: 0, base: 1, isAdvancing: true, teamIndex: 3, isAce }],
    runnerAceSprite,
  })

  it('마선수 주자는 실린 마선수 그림으로, 팔레트 없이 같은 프레임을 그린다', () => {
    render(<DefenseScreen state={주자상태(true, 2)} isRunning={false} />)
    expect(screen.getByTestId('defense-runner-1').getAttribute('data-folder')).toBe('./sprites/defender_roze/frames')
  })

  it('보통 주자 · 그림이 안 실린 마선수 주자는 defender 그림이다', () => {
    render(<DefenseScreen state={주자상태(false, 2)} isRunning={false} />)
    expect(screen.getByTestId('defense-runner-1').getAttribute('data-folder')).toBe('./sprites/defender/frames')
  })
})
