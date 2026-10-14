// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'

vi.mock('@/shared/lib/sprite/useFrameOrigins', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/lib/sprite/useFrameOrigins')>()
  const origins = new Proxy({}, { get: () => ({ x: 10, y: 20, width: 40, height: 30 }) })
  return { ...actual, useFrameOrigins: () => origins }
})

const { OutingMap } = await import('@/pages/outing-map/ui/OutingMap')

afterEach(cleanup)

describe('외출 지도 고른 건물 (0x7ec04~0x7ecc0)', () => {
  it('효과 0xb · 흰색으로 (x−1,y)(x,y−1)(x+1,y)(x,y+1) 네 번 찍은 뒤 건물을 그린다 — 고르지 않은 건물은 테두리가 없다', () => {
    const { container } = render(
      <OutingMap selectedPlaceId="hospital" eventPlaceIds={new Set()} noticeText="" onOpen={vi.fn()} onBack={vi.fn()} hour={10} />,
    )
    const stamps = Array.from(container.querySelectorAll<HTMLElement>('[data-solid-stamp="#FFFFFF"]'))
    // 지도 원점 (0, 11) + 프레임 원점 (10, 20)
    expect(stamps.map((stamp) => [stamp.style.left, stamp.style.top])).toEqual([
      ['9px', '31px'], ['10px', '30px'], ['11px', '31px'], ['10px', '32px'],
    ])
    expect(stamps[0]?.style.maskImage).toContain('event_map/frames/')
    // 건물 그림은 테두리 뒤(위)에 온다
    const building = container.querySelector('button[aria-label="병원"]')
    expect(building).not.toBeNull()
    expect(stamps[3]?.compareDocumentPosition(building as Node) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })
})
