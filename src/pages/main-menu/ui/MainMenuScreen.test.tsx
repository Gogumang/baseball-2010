// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { MainMenuScreen } from '@/pages/main-menu/ui/MainMenuScreen'
import { useMenuBand } from '@/pages/main-menu/model/useMenuBand'

/**
 * 메인 메뉴 머리띠 — 두 단 그리기가 다 끝에 0x54d95 를 부른다.
 *   윗단(하위 4) 0x2866c: `0x54d95(skin, 0, 1)` · 아랫단(하위 5) 0x2863c: `0x54d95(skin, 0, 5)`.
 * 제목 0 이라 G포인트도 그리고(0x550dc), 바닥 1 은 비트 0x4 가 없어 뒤로 표시가 없다(0x55220).
 */

// 아랫단 바탕 띠가 자라는 넉 틱 동안은 하위 5·9 가 키를 버린다(`[0xe2]` ≠ 0) — 틱을 시계로 돌린다
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout', 'clearTimeout'] })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** 띠가 다 자랄 만큼(넉 틱 넘게) 시계를 돌린다 */
const 틱지남 = () => act(() => {
  vi.advanceTimersByTime(1000)
})

/** 키 하나를 누르고 띠가 다 자랄 때까지 기다린다 */
const 누르기 = (key: string) => {
  act(() => {
    fireEvent.keyDown(window, { key })
  })
  틱지남()
}

const 띄우기 = (gamePoint?: number) => render(
  <MainMenuScreen
    hasSavedGame={false}
    onNewGame={vi.fn()}
    onSelectMode={vi.fn()}
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
    누르기('Enter')

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

    누르기('Enter')
    expect(container.querySelector('svg')).toBe(band)

    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))
    expect(container.querySelector('svg')).toBe(band)
  })
})

describe('일반모드 진입 창 [13] — 하위 12 0x296f0', () => {
  const 일반모드창 = (onSelectMode = vi.fn(), isGeneralGameInProgress = false) => {
    render(
      <MainMenuScreen hasSavedGame={false} onNewGame={vi.fn()} onSelectMode={onSelectMode}
        isGeneralGameInProgress={isGeneralGameInProgress}
        onHelp={vi.fn()} onSettings={vi.fn()} onSpecial={vi.fn()} />,
    )
    // 윗단 [게임시작] → 아랫단 최근게임 → ↓ 일반모드 → 시작
    for (const key of ['Enter', 'ArrowDown', 'Enter']) 누르기(key)
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
    누르기('Enter')
    expect(screen.getByRole('button', { name: '빠른실행' })).toBeTruthy()
  })
  it('전역기록 +0x4d 가 서 있으면 처음 커서는 이어하기(9)이고 OK 면 저장을 올려 경기로 간다', () => {
    const onSelectMode = 일반모드창(vi.fn(), true)
    expect(그림('이어하기')).toContain('popup/frames/009.png')
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onSelectMode).toHaveBeenCalledWith('일반모드경기이어하기')
  })

  it('+0x4d 가 서 있으면 새로하기는 [15] 확인을 먼저 띄운다 — 예라야 일반모드로 들어간다', () => {
    const onSelectMode = 일반모드창(vi.fn(), true)
    fireEvent.click(screen.getByRole('button', { name: '새로하기' }))
    expect(onSelectMode).not.toHaveBeenCalled()
    expect(screen.getByText('G포인트도 사라집니다', { exact: false })).toBeTruthy()
  })
})

describe('나만의리그 편 고르기 창 [14] — 하위 13 (진입 0x25d78 · 갱신 0x2464c)', () => {
  const 나리창 = (hasSavedGame: boolean, onNewGame = vi.fn()) => {
    render(
      <MainMenuScreen hasSavedGame={hasSavedGame} onNewGame={onNewGame} onSelectMode={vi.fn()}
        onHelp={vi.fn()} onSettings={vi.fn()} onSpecial={vi.fn()} />,
    )
    // 윗단 [게임시작] → 아랫단 최근게임 → ↓↓ 나만의리그 → 시작
    for (const key of ['Enter', 'ArrowDown', 'ArrowDown', 'Enter']) 누르기(key)
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

describe('최근게임 — 전역기록 +0x3c', () => {
  const 최근게임 = (lastPlayedMode: number, isGeneralGameInProgress = false) => {
    const onSelectMode = vi.fn()
    const onNewGame = vi.fn()
    render(
      <MainMenuScreen hasSavedGame={false} onNewGame={onNewGame} onSelectMode={onSelectMode}
        isGeneralGameInProgress={isGeneralGameInProgress} lastPlayedMode={lastPlayedMode}
        onHelp={vi.fn()} onSettings={vi.fn()} onSpecial={vi.fn()} />,
    )
    // 윗단 [게임시작] → 아랫단 커서 0(최근게임) → 시작
    for (const key of ['Enter', 'Enter']) 누르기(key)
    return { onSelectMode, onNewGame }
  }

  it('마지막 모드가 일반모드이고 +0x4d 면 곧바로 이어하기', () => {
    expect(최근게임(1, true).onSelectMode).toHaveBeenCalledWith('일반모드경기이어하기')
  })

  it('마지막 모드가 나리 타자편이면 그 편으로 (장면 0x106)', () => {
    expect(최근게임(4).onNewGame).toHaveBeenCalledWith('타자편')
  })
})

describe('[0x140006c] = 5 — 관리 메뉴 취소가 메인 메뉴를 게임시작 목록으로 바로 연다 (생성자 0x234d4 23830 · 진입 0x25b88)', () => {
  const 바로열기 = (gameStartCursor: { current: number }, onNewGame = vi.fn()) => {
    const rendered = render(
      <MainMenuScreen hasSavedGame={false} onNewGame={onNewGame} onSelectMode={vi.fn()}
        onHelp={vi.fn()} onSettings={vi.fn()} onSpecial={vi.fn()} gamePoint={0}
        openTier={5} gameStartCursor={gameStartCursor} />,
    )
    // 생성자가 띠를 1 로 세웠다 — 다 자랄 때까지 키를 버린다
    틱지남()
    return rendered
  }

  it('하위 5 로 서고 커서는 전역 [0x1552d24] 그 칸이다 — 앞 상태가 4 가 아니라 0 으로 되감지 않는다', () => {
    const onNewGame = vi.fn()
    바로열기({ current: 2 }, onNewGame) // 2 = 나만의리그
    // 아랫단 바닥 5 — 뒤로 표시가 선다
    expect(screen.getByRole('button', { name: '되돌아가기' })).toBeTruthy()
    누르기('Enter')
    // 나만의리그 → [14] 편 고르기 창
    expect(screen.getByText(/어떤 선수로/)).toBeTruthy()
  })

  it('CLR 은 처음 메뉴(하위 4)로 — 0x28cb0 의 0xbcb49(this+0x18, 4)', () => {
    바로열기({ current: 3 })
    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))
    expect(screen.queryByRole('button', { name: '되돌아가기' })).toBeNull()
  })

  it('커서가 움직이면 전역에 고쳐 적고, 윗단에서 내려오면 0 으로 되감는다(0x25b88 앞 상태 4)', () => {
    const cursor = { current: 2 }
    바로열기(cursor)
    누르기('ArrowDown')
    expect(cursor.current).toBe(3)
    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))
    누르기('Enter')
    expect(cursor.current).toBe(0)
  })
})

describe('바탕 띠 연출 [0xe2] · [0xe4] — 처음 메뉴 OK(0x294b8) · 생성자(0x2381c)가 1 로 세운다', () => {
  const 메뉴 = (props: Partial<Parameters<typeof MainMenuScreen>[0]> = {}) => render(
    <MainMenuScreen hasSavedGame={false} onNewGame={vi.fn()} onSelectMode={vi.fn()}
      onHelp={vi.fn()} onSettings={vi.fn()} onSpecial={vi.fn()} gamePoint={0} {...props} />,
  )
  const 띠 = (container: HTMLElement) => container.querySelector('[data-band-spread]')?.getAttribute('data-band-spread')

  it('열린 채로 서면 1 에서 자라고, 다 펼쳐진 채로 서라 하면 160 이다', () => {
    expect(renderHook(() => useMenuBand(true)).result.current).toEqual({ spread: 1, isGrowing: true })
    expect(renderHook(() => useMenuBand(true, true)).result.current).toEqual({ spread: 160, isGrowing: false })
  })

  it('윗단에서 내려갈 때마다 1 부터 다시 자란다 — 자라는 동안 하위 5 는 키를 버린다(0x28cc2)', () => {
    const onSelectMode = vi.fn()
    const { container } = 메뉴({ onSelectMode })
    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' })
    })
    expect(띠(container)).toBe('1')
    // 자라는 동안 OK 는 버려진다 — 최근게임으로 안 간다
    act(() => {
      fireEvent.keyDown(window, { key: 'ArrowDown' })
    })
    틱지남()
    expect(띠(container)).toBe('160')
    // ↓ 가 버려졌으니 커서는 여전히 최근게임(0) — 되돌아가기 뒤 다시 내려오면 또 1 부터
    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))
    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' })
    })
    expect(띠(container)).toBe('1')
  })

  it('같은 장면의 선수 고르기에서 돌아오면(isBandGrown) 펼쳐진 채로 서고 키를 곧바로 받는다', () => {
    const cursor = { current: 5 }
    const onSelectMode = vi.fn()
    const { container } = 메뉴({ openTier: 5, isBandGrown: true, gameStartCursor: cursor, onSelectMode })
    expect(띠(container)).toBe('160')
    act(() => {
      fireEvent.keyDown(window, { key: 'Enter' })
    })
    expect(onSelectMode).toHaveBeenCalledWith('홈런더비')
  })
})

describe('처음 메뉴 키 (0x29454) — CLR 은 안 보고, ←→·숫자도 커서다', () => {
  const 메뉴 = (props: Partial<Parameters<typeof MainMenuScreen>[0]> = {}) => render(
    <MainMenuScreen hasSavedGame={false} onNewGame={vi.fn()} onSelectMode={vi.fn()}
      onHelp={vi.fn()} onSettings={vi.fn()} onSpecial={vi.fn()} {...props} />,
  )

  it('타이틀로 가는 단추가 없고 CLR 은 아무 일도 안 한다', () => {
    const onHelp = vi.fn()
    메뉴({ onHelp })
    expect(screen.queryByRole('button', { name: /타이틀/ })).toBeNull()
    누르기('Escape')
    // 고른 칸은 0° 자리라 안 그린다 — 설명 판 글이 [게임시작] 그대로다
    expect(screen.getByText('원하는 게임모드를', { exact: false })).toBeTruthy()
  })

  it('→ · 6 · 8 은 다음 칸, ← · 2 · 4 는 앞 칸, 5 는 OK', () => {
    const onHelp = vi.fn()
    메뉴({ onHelp })
    누르기('ArrowRight')
    누르기('6')
    // 2 = 도움말
    누르기('8')
    누르기('4')
    누르기('5')
    expect(onHelp).toHaveBeenCalledTimes(1)
  })

  it('[게임문의] 는 OK 로 들어간다 (하위 10)', () => {
    const onInquiry = vi.fn()
    메뉴({ onInquiry })
    누르기('ArrowLeft')
    누르기('Enter')
    expect(onInquiry).toHaveBeenCalledTimes(1)
  })

  it('바퀴 커서 [this+0xe8] — 루트가 든 칸에서 서고 움직이면 고쳐 적는다', () => {
    const top = { current: 3 }
    const onSettings = vi.fn()
    메뉴({ topMenuCursor: top, onSettings })
    expect(screen.getByText('게임 환경 및', { exact: false })).toBeTruthy()
    누르기('ArrowDown')
    expect(top.current).toBe(4)
    누르기('ArrowUp')
    누르기('Enter')
    expect(onSettings).toHaveBeenCalledTimes(1)
    expect(top.current).toBe(3)
  })

  it('[랭킹] 은 하위 9 모드 목록 — 설명 [24]~, OK 는 서버 안내(근사), CLR 은 처음 메뉴', () => {
    메뉴({ topMenuCursor: { current: 4 }, gamePoint: 0 })
    누르기('Enter')
    expect(screen.getByText('일반모드의', { exact: false })).toBeTruthy()
    누르기('ArrowDown')
    expect(screen.getByText('나만의 리그의', { exact: false })).toBeTruthy()
    누르기('Enter')
    expect(screen.getByText('서버 통신이', { exact: false })).toBeTruthy()
    누르기('Enter')
    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))
    expect(screen.getByText('게임모드 별 랭킹', { exact: false })).toBeTruthy()
  })
})
