// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { OutingMap } from '@/pages/outing-map/ui/OutingMap'

afterEach(cleanup)

const 띄우기 = (hour: number) => render(
  <OutingMap selectedPlaceId="hospital" eventPlaceIds={new Set()} onOpen={vi.fn()} onBack={vi.fn()} hour={hour} />,
)

describe('외출 지도 밤 (0x7eba2 — 시간대 [gfx+0x1c] == 2)', () => {
  const 덮개수 = () => screen.getByTestId('외출지도-합성').getAttribute('data-composed-covers')

  it('20~5시(시간대 2)에만 화면을 단계 9 로 덮는다 — 합성 캔버스의 단계 덮기(검정 몸통 0x9aac4)', () => {
    띄우기(22)
    expect(덮개수()).toBe('1')
    cleanup()
    띄우기(5)
    expect(덮개수()).toBe('1')
  })

  it('낮(6~15) · 저녁(16~19)에는 덮개가 없다', () => {
    띄우기(10)
    expect(덮개수()).toBe('0')
    cleanup()
    띄우기(19)
    expect(덮개수()).toBe('0')
  })
})
