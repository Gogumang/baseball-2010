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

  it('윗단 ↔ 아랫단을 오가도 머리띠를 다시 내리지 않는다 — 하위 4·5 들어옴(0x24a40 · 0x25b88)은 [skin+0x84]·[+0x86] 을 안 건드린다', () => {
    const { container } = 띄우기(50)
    const band = container.querySelector('svg')

    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' })
    })
    expect(container.querySelector('svg')).toBe(band)

    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))
    expect(container.querySelector('svg')).toBe(band)
  })
})

describe('일반모드 진입 창 [13] — 하위 12 0x296f0', () => {
  const 일반모드창 = (onSelectMode = vi.fn()) => {
    render(
      <MainMenuScreen hasSavedGame={false} onContinue={vi.fn()} onNewGame={vi.fn()} onSelectMode={onSelectMode}
        onBack={vi.fn()} onHelp={vi.fn()} onSettings={vi.fn()} onSpecial={vi.fn()} />,
    )
    // 윗단 [게임시작] → 아랫단 최근게임 → ↓ 일반모드 → 시작
    for (const key of ['Enter', 'ArrowDown', 'Enter']) {
      act(() => {
        fireEvent.keyDown(window, { key })
      })
    }
    return onSelectMode
  }
  const 그림 = (name: string) => screen.getByRole('button', { name }).querySelector('img')?.getAttribute('src') ?? ''

  it('세 칸은 popup 그림 — 이어하기 4 · 새로하기 3 · 빠른실행 5, 처음 커서는 새로하기(고른 그림 8)', () => {
    일반모드창()

    expect(screen.getByText('진행하시겠습니까?', { exact: false })).toBeTruthy()
    expect(그림('이어하기')).toContain('popup/frames/004.png')
    expect(그림('새로하기')).toContain('popup/frames/008.png')
    expect(그림('빠른실행')).toContain('popup/frames/005.png')
  })

  it('한 열 격자라 ↑ 가 이어하기(9)로, ↓ 두 번이면 감겨 이어하기로 온다', () => {
    일반모드창()

    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(그림('이어하기')).toContain('popup/frames/009.png')
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(그림('빠른실행')).toContain('popup/frames/010.png')
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(그림('이어하기')).toContain('popup/frames/009.png')
  })

  it('새로하기는 일반모드, 빠른실행은 빠른실행으로 들어간다', () => {
    const onSelectMode = 일반모드창()
    fireEvent.click(screen.getByRole('button', { name: '빠른실행' }))
    expect(onSelectMode).toHaveBeenCalledWith('일반모드빠른실행')

    cleanup()
    const 새로 = 일반모드창()
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(새로).toHaveBeenCalledWith('일반모드')
  })

  it('CLR 은 −1 — 창만 닫고 게임시작 목록에 남는다', () => {
    const onSelectMode = 일반모드창()
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onSelectMode).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '빠른실행' })).toBeNull()
    // 아랫단(바닥 5) 그대로 — 다시 시작하면 창이 또 뜬다
    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' })
    })
    expect(screen.getByRole('button', { name: '빠른실행' })).toBeTruthy()
  })
})

describe('나만의리그 편 고르기 창 [14] — 하위 13 (진입 0x25d78 · 갱신 0x2464c)', () => {
  const 나리창 = (hasSavedGame: boolean, onNewGame = vi.fn()) => {
    render(
      <MainMenuScreen hasSavedGame={hasSavedGame} onContinue={vi.fn()} onNewGame={onNewGame} onSelectMode={vi.fn()}
        onBack={vi.fn()} onHelp={vi.fn()} onSettings={vi.fn()} onSpecial={vi.fn()} />,
    )
    // 윗단 [게임시작] → 아랫단 최근게임 → ↓↓ 나만의리그 → 시작
    for (const key of ['Enter', 'ArrowDown', 'ArrowDown', 'Enter']) {
      act(() => {
        fireEvent.keyDown(window, { key })
      })
    }
    return onNewGame
  }
  const 그림 = (name: string) => screen.getByRole('button', { name }).querySelector('img')?.getAttribute('src') ?? ''

  it('저장이 있어도 [15] 확인 없이 [14] 가 뜬다 — 타자편(고른 13)·투수편(보통 12), 처음 커서는 타자편', () => {
    나리창(true)

    expect(screen.queryByText('새로하시겠습니까?', { exact: false })).toBeNull()
    expect(screen.getByText('플레이 하시겠습니까?', { exact: false })).toBeTruthy()
    expect(그림('타자편')).toContain('popup/frames/013.png')
    expect(그림('투수편')).toContain('popup/frames/012.png')
  })

  it('Enter 는 타자편, → 뒤 Enter 는 투수편', () => {
    const 타자 = 나리창(false)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(타자).toHaveBeenCalledWith('타자편')

    cleanup()
    const 투수 = 나리창(false)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(그림('투수편')).toContain('popup/frames/014.png')
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(투수).toHaveBeenCalledWith('투수편')
  })

  it('CLR 은 창만 닫는다', () => {
    const onNewGame = 나리창(true)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onNewGame).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '타자편' })).toBeNull()
  })
})
