// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import { BODY_PANEL, HELP_ITEMS, ROW, rowLeftOf, rowTopOf } from '@/pages/help/lib/helpLayout'

/**
 * 도움말 (메인 메뉴 상태 9, 하위 목록 0x2524c — P6 2d).
 * 스페셜과 같은 목록에 표 0xceb37 의 다섯 칸(main_ui 프레임 7·8·9·10·13)이 선다.
 * 고르면 상태 37(0x2fccc) 가운데 192 창에 StrHOWTO 본문이 뜬다.
 */

afterEach(cleanup)

const 띄우기 = (overrides: Partial<Parameters<typeof HelpScreen>[0]> = {}) =>
  render(<HelpScreen onBack={vi.fn()} {...overrides} />)

const 칸 = (name: string) => screen.getByRole('button', { name })

describe('도움말 목록 배치', () => {
  it('원본 다섯 칸을 보여 준다 — 일반모드·나만의리그·시즌모드·대전모드·홈런더비', () => {
    띄우기()

    for (const name of ['일반모드', '나만의리그', '시즌모드', '대전모드', '홈런더비']) {
      expect(칸(name)).toBeTruthy()
    }
    expect(HELP_ITEMS).toHaveLength(5)
  })

  it('칸 그림은 main_ui 프레임 7·8·9·10·13 이다 (표 0xceb37)', () => {
    const { container } = 띄우기()
    const 그림 = [...container.querySelectorAll('img')].map((image) => image.getAttribute('src'))

    expect(HELP_ITEMS.map((item) => item.labelFrame)).toEqual([7, 8, 9, 10, 13])
    for (const item of HELP_ITEMS) {
      expect(그림).toContain(`./sprites/main_ui/frames/${String(item.labelFrame).padStart(3, '0')}.png`)
    }
  })

  it('줄은 스페셜과 같은 자리에 서고 오른쪽 끝이 x = 201 에 맞는다', () => {
    띄우기()

    expect(칸('일반모드').style.top).toBe(`${rowTopOf(0)}px`)
    expect(칸('나만의리그').style.top).toBe(`${rowTopOf(0) + ROW.step}px`)
    for (const item of HELP_ITEMS) {
      const 줄 = 칸(item.id)
      expect(줄.style.left).toBe(`${rowLeftOf(item)}px`)
      expect(Number.parseInt(줄.style.left, 10) + item.labelWidth).toBe(ROW.rightEdge)
    }
  })

  it('고른 칸 설명 판은 main_ui 이미지 3 이고 설명은 StrMAINMENU 원문이다', () => {
    const { container } = 띄우기()

    expect(container.querySelector('img[src="./sprites/main_ui/003.png"]')).toBeTruthy()
    expect(screen.getByText('원하는 팀을 선택해 자유롭게')).toBeTruthy()

    fireEvent.mouseEnter(칸('홈런더비'))

    expect(screen.getByText('홈런더비를 통해 타격감을')).toBeTruthy()
  })

  it('바닥띠 되돌아가기를 누르면 메인 메뉴로 나간다 (바닥 비트 0x4)', () => {
    const onBack = vi.fn()
    띄우기({ onBack })

    fireEvent.click(칸('되돌아가기'))

    expect(onBack).toHaveBeenCalled()
  })

  it('↑↓ 로 커서를 옮기고 Enter 로 연다', () => {
    띄우기()

    fireEvent.keyDown(window, { key: 'ArrowUp' }) // 위로 한 칸 = 마지막 칸 홈런더비
    fireEvent.keyDown(window, { key: 'Enter' })

    expect(screen.getByText('<홈런더비>')).toBeTruthy()
  })
})

describe('도움말 본문 (상태 37)', () => {
  it('가운데 192×212 판에 StrHOWTO 본문을 보여 준다', () => {
    const { container } = 띄우기()

    fireEvent.click(칸('나만의리그'))

    const 판 = container.querySelector(`div[style*="${BODY_PANEL.width}px"]`) as HTMLElement
    expect(판.style.left).toBe(`${BODY_PANEL.x}px`)
    expect(판.style.top).toBe(`${BODY_PANEL.y}px`)
    expect(screen.getByText('<나만의리그에 대하여>')).toBeTruthy()
  })

  it('좌우로 쪽을 넘긴다', () => {
    띄우기()

    fireEvent.click(칸('나만의리그'))
    expect(screen.getByText('1/7')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(screen.getByText('2/7')).toBeTruthy()
  })

  it('본문에서 되돌아가기를 누르면 목록으로 돌아온다', () => {
    띄우기()

    fireEvent.click(칸('시즌모드'))
    expect(screen.getByText('<시즌모드에 대하여>')).toBeTruthy()

    fireEvent.click(칸('되돌아가기'))

    expect(칸('홈런더비')).toBeTruthy()
  })
})
