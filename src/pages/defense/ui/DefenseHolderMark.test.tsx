// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { DefenseScreen } from '@/pages/defense/ui/DefenseScreen'
import { FIELDER_ACTION, type DefenseViewState } from '@/pages/defense/lib/defenseView'

/** game_ui 애니 1~3 (animations.json 그대로) */
const 애니들 = [
  [],
  [46, 47, 48, 49].map((frame) => ({ frame, delay: 2 })),
  [50, 47, 51, 49].map((frame) => ({ frame, delay: 2 })),
  [52, 53, 54, 55].map((frame) => ({ frame, delay: 2 })),
]

let 원래_fetch: typeof globalThis.fetch | undefined
beforeEach(() => {
  원래_fetch = globalThis.fetch
  globalThis.fetch = ((url: string) =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(url.endsWith('animations.json') ? 애니들 : {}),
    })) as unknown as typeof globalThis.fetch
})
afterEach(() => {
  cleanup()
  if (원래_fetch === undefined) delete (globalThis as { fetch?: unknown }).fetch
  else globalThis.fetch = 원래_fetch
})

/** 투수판을 보는 스냅샷 — 투수(칸 0)의 화면점은 (120, 196) */
const 상태 = (over: Partial<DefenseViewState> = {}): DefenseViewState => ({
  ball: { x: 20000, z: 24500, height: 0, isFlying: true },
  fielders: [{ slot: 0, x: 20000, z: 24500, action: FIELDER_ACTION.stand, actionTick: 0 }],
  runners: [],
  ...over,
})

describe('공 가진 야수 고리 + 이름 판 (0x43cb0)', () => {
  it('고리를 야수점에서 (11, 9) 당긴 자리에 애니 첫 칸으로 그린다 — 야수보다 먼저(밑에) 깐다', async () => {
    render(<DefenseScreen state={상태({ holderMark: { slot: 0, anim: 3 } })} isRunning={false} />)
    await act(async () => {})
    const ring = screen.getByTestId('수비-공고리')
    expect(ring.style.left).toBe('109px')
    expect(ring.style.top).toBe('187px')
    expect(ring.getAttribute('data-frame')).toBe('52')
    const fielder = screen.getByTestId('defense-fielder-0')
    expect(ring.compareDocumentPosition(fielder) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('투수 칸이면 보직 아이콘 · 글자와 이름을 오른쪽 아래 판에 적는다', async () => {
    render(<DefenseScreen state={상태({ holderMark: { slot: 0, anim: 1 }, holderPlate: { name: '마무리', pitcherRole: 2 } })} isRunning={false} />)
    await act(async () => {})
    expect(screen.getByTestId('수비-이름').textContent).toBe('마무리')
    // 구원 → 칸 5 + 0x20 = 37, 글자 0xb6
    expect(screen.getByTestId('수비-칸아이콘').getAttribute('data-frame')).toBe('37')
    expect(screen.getByTestId('수비-칸글자').getAttribute('data-frame')).toBe(String(0xb6))
  })

  it('고리가 없으면 아무것도 안 그린다', async () => {
    render(<DefenseScreen state={상태()} isRunning={false} />)
    await act(async () => {})
    expect(screen.queryByTestId('수비-공고리')).toBeNull()
    expect(screen.queryByTestId('수비-이름판')).toBeNull()
  })
})
