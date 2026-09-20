// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import { BODY_PANEL, RANKING_MENU_ITEMS } from '@/pages/help/lib/helpLayout'
import { GAME_INQUIRY_CHAPTER } from '@/shared/config/helpSections'

/**
 * 도움말 = 메인 메뉴 **상태 7** 의 StrHOWTO 뷰어 (0x2fc8c → 0x639a5 → 0x58d10 — S12 2절).
 * 장은 표 0xd0b18 = [5,5,7,6,3,6,4] 그대로 일곱이고, 메인 메뉴에서는 장 0~5 를 돈다.
 */

afterEach(cleanup)

const 띄우기 = (overrides: Partial<Parameters<typeof HelpScreen>[0]> = {}) =>
  render(<HelpScreen onBack={vi.fn()} {...overrides} />)

const 칸 = (name: string) => screen.getByRole('button', { name })

describe('도움말 본문 (상태 7)', () => {
  it('가운데 192×212 판에 장 0 [기본 조작] 첫 쪽부터 보여 준다 (0x63689(뷰어, 0))', () => {
    const { container } = 띄우기()

    const 판 = container.querySelector(`div[style*="${BODY_PANEL.width}px"]`) as HTMLElement
    expect(판.style.left).toBe(`${BODY_PANEL.x}px`)
    expect(판.style.top).toBe(`${BODY_PANEL.y}px`)
    expect(screen.getByText('<기본 조작>')).toBeTruthy()
    expect(screen.getByText('1/5')).toBeTruthy()
  })

  it('좌우로 쪽을 넘긴다 — 장 0 은 다섯 쪽이다', () => {
    띄우기()

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(screen.getByText('2/5')).toBeTruthy()
    expect(screen.getByText('<타격 조작>')).toBeTruthy()
  })

  it('위아래로 장을 넘긴다 — 0~5 를 돌고 되감는다 (0x638be · 0x63914)', () => {
    띄우기()

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(screen.getByText('<일반모드에 대하여>')).toBeTruthy()

    // 되감기 — 장 0 에서 위로 가면 마지막으로 돌아다닐 수 있는 장 5 다
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(screen.getByText('<홈런더비>')).toBeTruthy()
  })

  it('앞서 "다섯 칸뿐이라 못 본다" 던 기본 조작·미션모드·환경설정도 모두 보인다', () => {
    띄우기()

    // 장 5 = 홈런더비·미션모드·스페셜·G포인트·환경설정 한 묶음 ([26]~[31])
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(screen.getByText('<홈런더비>')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('<미션모드>')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('<환경설정-상세설정>')).toBeTruthy()
  })

  it('게임문의(장 6)는 잠긴 채 열린다 — 상태 10 의 [뷰어+0x45c] = 1', () => {
    띄우기({ chapter: GAME_INQUIRY_CHAPTER, isChapterLocked: true })

    expect(screen.getByText('<게임문의>')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '다음 장' })).toBeNull()

    fireEvent.keyDown(window, { key: 'ArrowDown' })

    expect(screen.getByText('<게임문의>')).toBeTruthy()
  })

  it('바닥띠 되돌아가기를 누르면 메인 메뉴로 나간다 (바닥 비트 0x4)', () => {
    const onBack = vi.fn()
    띄우기({ onBack })

    fireEvent.click(칸('되돌아가기'))

    expect(onBack).toHaveBeenCalled()
  })
})

describe('랭킹 하위 메뉴 값 (상태 9 — 도움말이 아니다)', () => {
  it('칸은 main_ui 프레임 7·8·9·10·13 이고 설명은 StrMAINMENU[24+커서] 다', () => {
    expect(RANKING_MENU_ITEMS.map((item) => item.labelFrame)).toEqual([7, 8, 9, 10, 13])
    expect(RANKING_MENU_ITEMS[0].description).toBe('일반모드의!N순위를 확인합니다')
  })
})
