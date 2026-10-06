// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MainMenuScreen } from '@/pages/main-menu/ui/MainMenuScreen'

/**
 * 메인 메뉴 머리띠 — 두 단 그리기가 다 끝에 0x54d95 를 부른다.
 *   윗단(하위 4) 0x2866c: `0x54d95(skin, 0, 1)` · 아랫단(하위 5) 0x2863c: `0x54d95(skin, 0, 5)`.
 * 제목 0 이라 G포인트도 그리고(0x550dc), 바닥 1 은 비트 0x4 가 없어 뒤로 표시가 없다(0x55220).
 */

afterEach(cleanup)

const 띄우기 = (gamePoint?: number) => render(
  <MainMenuScreen
    hasSavedGame={false}
    onContinue={vi.fn()}
    onNewGame={vi.fn()}
    onSelectMode={vi.fn()}
    onBack={vi.fn()}
    onHelp={vi.fn()}
    onSettings={vi.fn()}
    onSpecial={vi.fn()}
    {...(gamePoint === undefined ? {} : { gamePoint })}
  />,
)

const 그림들 = (container: HTMLElement) => [...container.querySelectorAll('img')].map((img) => img.getAttribute('src') ?? '')
const G숫자 = (container: HTMLElement) => 그림들(container).filter((src) => /^\.\/sprites\/gpoint\/00\d\.png$/.test(src))

describe('메인 메뉴 머리띠 0x54d95(skin, 0, 1|5)', () => {
  it('윗단(하위 4)은 제목 0 "2010프로야구"(game_frame 3) + G — 바닥 1 이라 뒤로 표시(game_frame 21)는 없다', () => {
    const { container } = 띄우기(1234)

    const srcs = 그림들(container)
    expect(srcs).toContain('./sprites/game_frame/003.png')
    expect(G숫자(container)).toHaveLength(4)
    expect(srcs).not.toContain('./sprites/game_frame/021.png')
    expect(screen.queryByRole('button', { name: '되돌아가기' })).toBeNull()
    // 바닥띠 오른쪽 탭(game_frame 19·20)은 바닥비트와 상관없이 그린다 (0x55110~0x5521c)
    expect(srcs).toContain('./sprites/game_frame/019.png')
  })

  it('아랫단(하위 5)은 바닥 5 — 뒤로 표시가 서고 누르면 윗단으로 돌아간다', () => {
    const { container } = 띄우기(50)
    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' })
    })

    expect(그림들(container)).toContain('./sprites/game_frame/021.png')
    expect(G숫자(container)).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))
    expect(screen.queryByRole('button', { name: '되돌아가기' })).toBeNull()
  })

  it('G 를 안 넘기면 예전처럼 머리띠를 안 그린다', () => {
    const { container } = 띄우기()
    expect(그림들(container)).not.toContain('./sprites/game_frame/003.png')
  })
})
