// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { OutingMap } from '@/pages/outing-map/ui/OutingMap'

afterEach(cleanup)

const 띄우기 = (hour: number) => render(
  <OutingMap selectedPlaceId="hospital" eventPlaceIds={new Set()} onOpen={vi.fn()} onBack={vi.fn()} hour={hour} />,
)

describe('외출 지도 밤 (0x7eba2 — 시간대 [gfx+0x1c] == 2)', () => {
  it('20~5시(시간대 2)에만 화면을 단계 9(검정 7/16)로 덮는다', () => {
    띄우기(22)
    expect(screen.getByTestId('외출지도-밤덮개').style.opacity).toBe(String(7 / 16))
    cleanup()
    띄우기(5)
    expect(screen.getByTestId('외출지도-밤덮개')).toBeTruthy()
  })

  it('낮(6~15) · 저녁(16~19)에는 덮개가 없다', () => {
    띄우기(10)
    expect(screen.queryByTestId('외출지도-밤덮개')).toBeNull()
    cleanup()
    띄우기(19)
    expect(screen.queryByTestId('외출지도-밤덮개')).toBeNull()
  })
})
