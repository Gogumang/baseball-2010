// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PlaceBubble } from '@/pages/outing-map/ui/PlaceBubble'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import { MAP_TOP } from '@/pages/outing-map/ui/OutingMapScreen.css'

/**
 * 장소 기능 말풍선 (0x7ee1a, F-2 2-7).
 * 칸은 두 개뿐이고(들어가기 · 기능) 비용·설명 글이 없다.
 */

afterEach(cleanup)

const 경기장 = OUTING_PLACES[0]

const 띄우기 = (overrides: Partial<Parameters<typeof PlaceBubble>[0]> = {}) =>
  render(
    <PlaceBubble
      place={경기장}
      canEnter
      onEnter={vi.fn()}
      onRun={vi.fn()}
      onClose={vi.fn()}
      {...overrides}
    />,
  )

describe('장소 기능 말풍선', () => {
  it('칸은 [들어가기] 와 장소 기능 둘뿐이다 — 비용·설명 줄이 없다', () => {
    띄우기()
    const buttons = screen.getAllByRole('button')

    expect(buttons.map((button) => button.textContent)).toEqual(['들어가기', 경기장.functions[0].name])
  })

  it('박스 3 자리에 지도 오프셋만큼 내려 놓는다', () => {
    const { container } = 띄우기()
    const bubble = container.firstElementChild as HTMLElement

    expect(bubble.style.left).toBe(`${경기장.bubbleBox.x}px`)
    expect(bubble.style.top).toBe(`${경기장.bubbleBox.y + MAP_TOP}px`)
    expect(bubble.style.width).toBe(`${경기장.bubbleBox.width}px`)
    expect(bubble.style.height).toBe(`${경기장.bubbleBox.height}px`)
  })

  it('칸 배치는 (R.x+4, R.y+4, R.w−8, (R.h−12)>>1) 과 그 아래 +4 다', () => {
    띄우기()
    const [first, second] = screen.getAllByRole('button')
    const width = 경기장.bubbleBox.width - 8
    const height = (경기장.bubbleBox.height - 12) >> 1

    expect(first.style.width).toBe(`${width}px`)
    expect(first.style.height).toBe(`${height}px`)
    expect(first.style.left).toBe('4px')
    expect(first.style.top).toBe('4px')
    expect(second.style.top).toBe(`${4 + height + 4}px`)
  })

  it('고른 칸만 노랑 테두리와 노랑 글씨다 — 처음 고른 칸은 [들어가기]', () => {
    띄우기()
    const [first, second] = screen.getAllByRole('button')

    expect(first.style.color).toBe('rgb(255, 255, 0)')
    expect(first.style.outline).toBe('1px solid #FFFF00')
    expect(second.style.color).toBe('rgb(255, 255, 255)')
    expect(second.style.outline).toBe('')
  })

  it('아래 칸을 고르면 그 장소의 기능을 실행한다', () => {
    const onRun = vi.fn()
    띄우기({ onRun })

    fireEvent.click(screen.getAllByRole('button')[1])

    expect(onRun).toHaveBeenCalledWith(경기장.functions[0].id)
  })

  it('이번 주기에 이미 행동했으면 [들어가기] 가 아무 일도 하지 않는다', () => {
    const onEnter = vi.fn()
    띄우기({ canEnter: false, onEnter })

    fireEvent.click(screen.getAllByRole('button')[0])

    expect(onEnter).not.toHaveBeenCalled()
  })

  it('위아래 키로 칸을 옮기고 Escape 로 닫는다', () => {
    const onClose = vi.fn()
    띄우기({ onClose })

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(screen.getAllByRole('button')[1].style.color).toBe('rgb(255, 255, 0)')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
