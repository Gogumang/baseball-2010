// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { TrainingFigure } from '@/widgets/training-scene/ui/TrainingFigure'

/**
 * 훈련 팝업 선수 그림의 팔레트 — 기본정보 카드와 같은 적재 0x10810 → 0x78ab0 (C-1 확정).
 * 몸통 = 피부 × 15 + 팀 (0x78be8) · 헬멧 = 팀 (0x78c14). 예전엔 구운 색 그대로였다.
 */

const 칠하기 = vi.hoisted(() => vi.fn((url: string, _palette: number | null) => url))
vi.mock('@/shared/lib/sprite/paletteSwap', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/sprite/paletteSwap')>()),
  useRecoloredSprite: 칠하기,
}))

afterEach(() => {
  cleanup()
  칠하기.mockClear()
})

const 벌 = (folder: string) => 칠하기.mock.calls.find(([url]) => url.startsWith(`${folder}/`))?.[1]

describe('훈련 팝업 선수 그림 팔레트', () => {
  it('몸통은 피부 × 15 + 팀, 헬멧은 팀 벌로 칠한다', () => {
    render(<TrainingFigure pose={0} x={0} y={0} skinIndex={2} teamIndex={4} />)

    expect(벌('./sprites/batter_balancer/frames')).toBe(2 * 15 + 4)
    expect(벌('./sprites/batter_helmet/frames')).toBe(4)
  })

  it('그림자는 여전히 끈다 (0x1085c `fig+0x48 = 0`)', () => {
    render(<TrainingFigure pose={0} x={0} y={0} skinIndex={2} teamIndex={4} />)

    expect(칠하기.mock.calls.some(([url]) => url.includes('shadow'))).toBe(false)
  })
})
