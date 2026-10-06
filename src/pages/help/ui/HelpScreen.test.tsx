// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import {
  BODY_PANEL,
  HELP_PANEL_CLOSE_HEIGHTS,
  HELP_PANEL_FULL_HEIGHT,
  HELP_PANEL_OPEN_HEIGHTS,
  RANKING_MENU_ITEMS,
} from '@/pages/help/lib/helpLayout'
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
  it('가운데 192 판에 장 0 [기본 조작] 첫 쪽부터 보여 준다 (0x63689(뷰어, 0)) — 판은 높이 0x20 에서 열리기 시작한다', () => {
    const { container } = 띄우기()

    const 판 = container.querySelector(`div[style*="width: ${BODY_PANEL.width}px"]`) as HTMLElement
    expect(판.style.left).toBe(`${BODY_PANEL.x}px`)
    // 첫 그리기는 +0x90 = 0x20 — 가운데 H/2 에서 위아래로 16
    expect(판.style.height).toBe(`${HELP_PANEL_OPEN_HEIGHTS[0]}px`)
    expect(판.style.top).toBe(`${160 - 16}px`)
    expect(screen.getByText('<기본 조작>')).toBeTruthy()
    expect(screen.getByText('1/5')).toBeTruthy()
  })

  it('판 높이 연출 — 열 때 32 → 36 → 52 → 116 → 212, 닫을 때 212 → 208 → 192 → 128 (0x59300~0x593a8)', () => {
    expect(HELP_PANEL_OPEN_HEIGHTS).toEqual([32, 36, 52, 116])
    expect(HELP_PANEL_CLOSE_HEIGHTS).toEqual([212, 208, 192, 128])
    expect(HELP_PANEL_FULL_HEIGHT).toBe(BODY_PANEL.height)
  })

  it('여는 때는 장 고르기 — 좌우가 장을 넘기고 0~5 를 돌며 되감는다 (0x638a0 · 0x638fe)', () => {
    띄우기()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('<일반모드에 대하여>')).toBeTruthy()

    // 되감기 — 장 0 에서 왼쪽이면 마지막으로 돌아다닐 수 있는 장 5 다
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('<홈런더비>')).toBeTruthy()
  })

  it('OK(또는 아래)로 쪽 보기에 들어가면 좌우가 쪽을 넘긴다 — 장 0 은 다섯 쪽이다', () => {
    띄우기()

    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(screen.getByText('2/5')).toBeTruthy()
    expect(screen.getByText('<타격 조작>')).toBeTruthy()
  })

  it('CLR 은 쪽 보기면 장 고르기로, 장 고르기면 닫기다 (0x63840)', () => {
    const onBack = vi.fn()
    띄우기({ onBack })

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onBack).not.toHaveBeenCalled()

    // 다시 장 고르기라 좌우가 장을 넘긴다
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('<일반모드에 대하여>')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('앞서 "다섯 칸뿐이라 못 본다" 던 기본 조작·미션모드·환경설정도 모두 보인다', () => {
    띄우기()

    // 장 5 = 홈런더비·미션모드·스페셜·G포인트·환경설정 한 묶음 ([26]~[31])
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('<홈런더비>')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Enter' })
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

    // 상태 10 은 쪽 보기로 열린다(+0xe5 = 0) — 좌우는 쪽, OK·아래는 잠겨 아무 일 없다, CLR 은 바로 닫기
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(screen.getByText('<게임문의>')).toBeTruthy()
    // 둘째 쪽은 빈 StrHOWTO[33] — 표 0xd0b18 그대로 한 쪽이고 등급표(0x54330)를 그린다
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('2/4')).toBeTruthy()
    expect(screen.getByTestId('등급표')).toBeTruthy()
    expect(screen.getByText('MO-090814-004')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('<주의사항>')).toBeTruthy()
  })

  it('게임문의는 CLR 한 번에 닫힌다 (잠김 → 63840 닫기)', () => {
    const onBack = vi.fn()
    띄우기({ chapter: GAME_INQUIRY_CHAPTER, isChapterLocked: true, onBack })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('바닥띠 되돌아가기를 누르면 메인 메뉴로 나간다 (바닥 비트 0x4)', () => {
    const onBack = vi.fn()
    띄우기({ onBack, gamePoint: 0 })

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

describe('머리띠 0x54d95(skin, 0, 5) — 도움말(상태 7) 그리기 0x2fc8c', () => {
  const 그림들 = (container: HTMLElement) => [...container.querySelectorAll('img')].map((img) => img.getAttribute('src') ?? '')

  it('G 를 넘기면 제목 0 "2010프로야구"(game_frame 3) + G포인트 + 되돌아가기', () => {
    const onBack = vi.fn()
    const { container } = 띄우기({ gamePoint: 305, onBack })

    const srcs = 그림들(container)
    expect(srcs).toContain('./sprites/game_frame/003.png')
    expect(srcs).toContain('./sprites/gpoint/003.png')
    expect(srcs).toContain('./sprites/gpoint/005.png')
    fireEvent.click(칸('되돌아가기'))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('G 를 안 넘기면(경기 중 [조작방법]) 머리띠·바닥띠가 없다 — 0x3cdd0 갈래 4 는 뷰어 0x639a5 만 그린다', () => {
    const onBack = vi.fn()
    const { container } = 띄우기({ onBack })
    expect(그림들(container).filter((src) => src.startsWith('./sprites/game_frame/'))).toHaveLength(0)
    expect(그림들(container).filter((src) => src.startsWith('./sprites/gpoint/'))).toHaveLength(0)
    expect(screen.queryByRole('button', { name: '되돌아가기' })).toBeNull()

    // 웹판 편의 [닫기] — 원본은 CLR 로만 닫는다
    fireEvent.click(칸('닫기'))
    expect(onBack).toHaveBeenCalledOnce()
  })
})

describe('경기 중 [조작방법] — 멈춘 경기 장면 위에 얹힌다', () => {
  it('뷰어가 키를 다 먹는다 — 뒤 경기 화면의 듣개로 안 넘어간다 (하위 4 키는 0x637d0 에만)', () => {
    const 뒤 = vi.fn()
    window.addEventListener('keydown', 뒤)
    try {
      render(<HelpScreen onBack={vi.fn()} />)
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      fireEvent.keyDown(window, { key: '5' })
      expect(뒤).not.toHaveBeenCalled()
      expect(screen.getByText('<일반모드에 대하여>')).toBeTruthy()
    } finally {
      window.removeEventListener('keydown', 뒤)
    }
  })

  it('메인 메뉴 도움말(상태 7)은 예전처럼 키를 막지 않는다', () => {
    const 뒤 = vi.fn()
    window.addEventListener('keydown', 뒤)
    try {
      render(<HelpScreen onBack={vi.fn()} gamePoint={0} />)
      fireEvent.keyDown(window, { key: 'ArrowRight' })
      expect(뒤).toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', 뒤)
    }
  })
})

describe('뷰어 그리기 0x58fd4 — 장 고르기/쪽 보기 그림 차이와 줄 넘기기', () => {
  it('쪽 보기에서 아래 키는 글을 한 줄 내리고 스크롤 손잡이가 걸음만큼 내려간다 (0x61ce4)', () => {
    띄우기()
    // 장 5 의 넷째 쪽 [29]~ 은 길다 — 장 5 둘째 쪽 [27] 미션모드로 가서 쪽 보기
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    // [28] 스페셜은 11줄보다 길다
    expect(screen.getByText('<스페셜>')).toBeTruthy()
    const 손잡이 = () => (screen.getByTestId('스크롤손잡이') as HTMLElement).style.top
    const 처음 = 손잡이()
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(screen.queryByText('<스페셜>')).toBeNull()
    expect(손잡이()).not.toBe(처음)
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(screen.getByText('<스페셜>')).toBeTruthy()
  })

  it('장 띠는 slt_frame 프레임 55+장, 장 이름은 img_text 프레임 표 0xd1ad0 이다', () => {
    const { container } = 띄우기()
    const srcs = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'))
    expect(srcs).toContain('./sprites/slt_frame/frames/055.png')
    expect(srcs).toContain('./sprites/img_text/frames/008.png')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    const 다음 = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'))
    expect(다음).toContain('./sprites/slt_frame/frames/056.png')
    expect(다음).toContain('./sprites/img_text/frames/009.png')
  })
})

describe('닫기 연출 — [뷰어+0x125] 가 없으면(메인 메뉴) CLR 뒤 판이 4프레임에 걸쳐 줄고 나서 닫힌다 (0x63850 · 0x63964)', () => {
  it('경기 중(+0x125 = 1)은 곧장, 메인 메뉴는 4프레임 뒤에 닫힌다', () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout'] })
    try {
      const onBack = vi.fn()
      띄우기({ onBack, gamePoint: 0 })
      fireEvent.keyDown(window, { key: 'Escape' })
      expect(onBack).not.toHaveBeenCalled()
      act(() => {
        vi.advanceTimersByTime(62 * 6)
      })
      expect(onBack).toHaveBeenCalledOnce()
    } finally {
      vi.useRealTimers()
    }
  })
})
