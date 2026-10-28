// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSilentSound, setActiveSound } from '@/shared/api/audio/soundPort'
import { InGameMenu } from '@/features/play-team-game/ui/InGameMenu'
import { inGameMenuLayoutOf, inGameMenuSlideAt } from '@/features/play-team-game/model/inGameMenu'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { useInGameMenuState } from '@/features/play-team-game/model/useInGameMenuState'

afterEach(cleanup)

const 칸 = (name: string) => screen.getByRole('option', { name })
const 고른칸 = () => screen.getAllByRole('option').find((option) => option.getAttribute('aria-selected') === 'true')
const 예 = () => screen.getByRole('button', { name: '예' })
const 아니오 = () => screen.getByRole('button', { name: '아니오' })

describe('경기 중 메뉴 판 — 그리기 0x3cdd0 (하위 0~3)', () => {
  it('판은 왼쪽 아래 — h = 칸수 × 14 + 21 · y = 320 − h − 18 · x = [+0x1954] − 0x45', () => {
    const five = inGameMenuLayoutOf(5, 0x44)
    expect(five.box).toEqual({ x: -1, y: 211, width: 70, height: 91 })
    expect(five.title).toEqual({ x: 7, y: 216 })
    expect(five.rows[0]).toEqual({
      pill: { x: 2, y: 229, width: 65, height: 14 },
      digit: { centerX: 8, y: 231, value: 1 },
      label: { x: 16, y: 231 },
    })
    expect(five.rows[4]?.pill.y).toBe(229 + 56)
    const four = inGameMenuLayoutOf(4, 0x44)
    expect(four.box).toEqual({ x: -1, y: 225, width: 70, height: 77 })
  })

  it("'*' 로 새로 열면 왼쪽에서 밀려 든다 — 그린 뒤 걸음 ×2 · 0x44 에서 멈춤 (0x3d0ca~0x3d0ee)", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(inGameMenuSlideAt)).toEqual([0, 2, 6, 14, 30, 62, 68, 68])
  })

  it('칸 이름은 img_text 표 0xcff9c 그림이다 — 고른 칸만 노란 칠', () => {
    render(<InGameMenu mode={1} onContinue={vi.fn()} cursor={2} />)
    expect(screen.getByTestId('경기-메뉴-칸-2').dataset.selected).toBe('true')
    expect(screen.getByTestId('경기-메뉴-칸-0').dataset.selected).toBe('false')
    expect(screen.getByTestId('경기-메뉴-판').dataset.slide).toBe('68')
  })

  it('대전 6회 제한이면 자동진행 칸 이름이 회색 단색이다 (3cf0a · 3cfa4)', () => {
    render(<InGameMenu mode={8} onContinue={vi.fn()} onAutoProgress={vi.fn()} gamePoint={999} canAutoProgress={false} />)
    expect(screen.getByTestId('경기-메뉴-칸-1').dataset.grey).toBe('true')
  })

  it('밀려 들기를 켜면 0 에서 시작해 틀마다 나아간다', () => {
    vi.useFakeTimers()
    try {
      render(<InGameMenu mode={1} onContinue={vi.fn()} slidesIn />)
      expect(screen.getByTestId('경기-메뉴-판').dataset.slide).toBe('0')
      act(() => {
        vi.advanceTimersByTime(10_000)
      })
      expect(screen.getByTestId('경기-메뉴-판').dataset.slide).toBe('68')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('경기 중 메뉴 — 칸 (표 0xcfcfc)', () => {
  it('일반·시즌·대전 행 — 계속하기 · 자동진행 · 게임방법 · 환경설정 · 메인메뉴', () => {
    render(<InGameMenu mode={1} onContinue={vi.fn()} />)
    expect(screen.getAllByRole('option').map((option) => option.getAttribute('aria-label'))).toEqual([
      '계속하기',
      '자동진행',
      '게임방법',
      '환경설정',
      '메인메뉴',
    ])
  })

  it('미션·홈런더비 행에는 자동진행 대신 재도전이 있다', () => {
    render(<InGameMenu mode={6} onContinue={vi.fn()} onRestart={vi.fn()} />)
    expect(칸('재도전')).toBeTruthy()
    expect(screen.queryByRole('option', { name: '자동진행' })).toBeNull()
  })

  it('나만의리그 행은 네 칸이다', () => {
    render(<InGameMenu mode={3} onContinue={vi.fn()} />)
    expect(screen.getAllByRole('option')).toHaveLength(4)
  })
})

describe('경기 중 메뉴 — 다시하기 (표 0xcfcfc 행 1, 0x3c706)', () => {
  it('StrGAME[7] 문구로 한 번 묻고, 예를 고르면 다시 시작한다', () => {
    const onRestart = vi.fn()
    render(<InGameMenu mode={6} onContinue={vi.fn()} onRestart={onRestart} />)

    fireEvent.click(칸('재도전'))
    expect(screen.getByText(/다시 플레이하시겠습니까/)).toBeTruthy()

    fireEvent.click(예())
    expect(onRestart).toHaveBeenCalledTimes(1)
  })

  it('아니오면 아무 일도 없고 메뉴로 돌아온다', () => {
    const onRestart = vi.fn()
    render(<InGameMenu mode={6} onContinue={vi.fn()} onRestart={onRestart} />)

    fireEvent.click(칸('재도전'))
    fireEvent.click(아니오())

    expect(onRestart).not.toHaveBeenCalled()
    expect(screen.getByRole('listbox', { name: '경기 중 메뉴' })).toBeTruthy()
  })

  it('손잡이를 안 넘긴 칸은 잠긴다', () => {
    render(<InGameMenu mode={6} onContinue={vi.fn()} />)

    expect((칸('재도전') as HTMLButtonElement).disabled).toBe(true)
    expect((칸('메인메뉴') as HTMLButtonElement).disabled).toBe(true)
    expect((칸('계속하기') as HTMLButtonElement).disabled).toBe(false)
  })
})

describe("경기 중 메뉴 커서 — 메뉴 객체(+0xf30)를 0 으로 되돌리는 곳은 '*' 로 여는 0x3c02c 뿐이다", () => {
  it('넘겨받은 커서 칸에서 시작한다 — [조작방법]·[설정]에서 돌아올 때 (0x3ca36 · 0x3cb0e)', () => {
    render(<InGameMenu mode={3} cursor={2} onContinue={vi.fn()} />)
    expect(고른칸()?.getAttribute('aria-label')).toBe('환경설정')
  })

  it('커서가 옮겨지면 알려 준다 — 세로 감기(꼴 0x20)', () => {
    const onCursorChange = vi.fn()
    render(<InGameMenu mode={3} onContinue={vi.fn()} onCursorChange={onCursorChange} />)
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(onCursorChange).toHaveBeenLastCalledWith(1)
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    expect(onCursorChange).toHaveBeenLastCalledWith(3)
  })

  it('질문 창에서 아니오로 돌아와도 커서가 남는다', () => {
    render(<InGameMenu mode={6} onContinue={vi.fn()} onRestart={vi.fn()} />)
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByText(/다시 플레이하시겠습니까/)).toBeTruthy()
    fireEvent.click(아니오())
    expect(고른칸()?.getAttribute('aria-label')).toBe('재도전')
  })
})

describe('경기 중 메뉴 — 나가기 (동작 3 0x3c504 → 하위 1 0x3c77c → 상태 0x22)', () => {
  it('모드 1~4·8·9 는 StrGAME[0], 미션·홈런더비는 StrGAME[1] 로 묻는다 (0x74ef5 종류 2)', () => {
    render(<InGameMenu mode={3} onContinue={vi.fn()} onQuit={vi.fn()} />)
    fireEvent.click(칸('메인메뉴'))
    expect(screen.getByText(/G포인트가 사라집니다/)).toBeTruthy()
    cleanup()

    render(<InGameMenu mode={6} onContinue={vi.fn()} onQuit={vi.fn()} />)
    fireEvent.click(칸('메인메뉴'))
    expect(screen.getByText(/진행 중인 게임을 그만하고/)).toBeTruthy()
  })

  it('처음 커서는 [예]다 (0x749d5 없음) — [아니오] 면 메뉴로 돌아온다', () => {
    const onQuit = vi.fn()
    render(<InGameMenu mode={7} onContinue={vi.fn()} onQuit={onQuit} />)
    fireEvent.click(칸('메인메뉴'))
    fireEvent.click(아니오())
    expect(onQuit).not.toHaveBeenCalled()
    fireEvent.click(칸('메인메뉴'))
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onQuit).toHaveBeenCalledTimes(1)
  })
})

describe('경기 중 메뉴 — 자동진행 알림 문구는 StrGAME 원문이다', () => {
  it('[2] 대전 6회 제한 · [5] G포인트 부족', () => {
    render(<InGameMenu mode={8} onContinue={vi.fn()} onAutoProgress={vi.fn()} gamePoint={999} canAutoProgress={false} />)
    fireEvent.click(칸('자동진행'))
    expect(screen.getByText(/자동진행 가능합니다/)).toBeTruthy()
    cleanup()

    render(<InGameMenu mode={1} onContinue={vi.fn()} onAutoProgress={vi.fn()} autoProgressCost={100} gamePoint={0} />)
    fireEvent.click(칸('자동진행'))
    fireEvent.click(예())
    expect(screen.getByText(/자동진행을 할 수 없습니다/)).toBeTruthy()
    expect(screen.getByText(/에서 충전할 수 있습니다/)).toBeTruthy()
  })
})

describe('경기 중 메뉴 — [조작방법] · [설정] 은 울리던 소리를 끊는다 (0x3c2f8 · 0x3c45c 의 0x6e418)', () => {
  const 통로 = () => {
    const port = { ...createSilentSound(), stop: vi.fn() }
    setActiveSound(port)
    return port
  }
  afterEach(() => setActiveSound(null))

  it('[게임방법] 을 고르면 끊고 뷰어를 연다', () => {
    const port = 통로()
    const onOpenHelp = vi.fn()
    render(<InGameMenu mode={3} onContinue={vi.fn()} onOpenHelp={onOpenHelp} />)

    fireEvent.click(칸('게임방법'))

    expect(port.stop).toHaveBeenCalledTimes(1)
    expect(onOpenHelp).toHaveBeenCalledTimes(1)
  })

  it('[환경설정] 을 고르면 끊고 설정을 연다', () => {
    const port = 통로()
    const onOpenSettings = vi.fn()
    render(<InGameMenu mode={3} onContinue={vi.fn()} onOpenSettings={onOpenSettings} />)

    fireEvent.click(칸('환경설정'))

    expect(port.stop).toHaveBeenCalledTimes(1)
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
  })

  it('[계속하기] 는 끊지 않는다', () => {
    const port = 통로()
    render(<InGameMenu mode={3} onContinue={vi.fn()} />)

    fireEvent.click(칸('계속하기'))

    expect(port.stop).not.toHaveBeenCalled()
  })
})

describe('경기 중 메뉴 숫자키 — 목록 0x6bfe1(1열, 4|5줄, 숫자키 꼴 2, 0x230) (0x3c08e · 0x6c100)', () => {
  it('숫자 n 은 n 번째 칸을 바로 고르고 OK 다 — 1 = 계속하기', () => {
    const onContinue = vi.fn()
    render(<InGameMenu mode={6} onContinue={onContinue} />)
    fireEvent.keyDown(window, { key: '1' })
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('칸이 있으면 커서를 옮기고 묻는 칸이면 질문으로 간다 — 칸 수를 넘는 숫자는 아무 일도 없다', () => {
    const onCursorChange = vi.fn()
    render(<InGameMenu mode={6} onContinue={vi.fn()} onRestart={vi.fn()} onCursorChange={onCursorChange} />)
    fireEvent.keyDown(window, { key: '9' })
    expect(onCursorChange).not.toHaveBeenCalledWith(8)

    fireEvent.keyDown(window, { key: '2' })
    expect(screen.getByText(/다시 플레이하시겠습니까/)).toBeTruthy()
  })
})

describe('경기 중 메뉴 — 창 뒤 어둡게 (0x741a0 · 0x746cc, 경기 생성자 0x3301c 의 [창+0x24f] = 1)', () => {
  it('메뉴 뒤를 검정 단계 5 = 6/16 한 겹으로 덮는다', () => {
    render(<InGameMenu mode={6} onContinue={vi.fn()} />)

    const dim = screen.getByTestId('경기-메뉴-어둡게')
    expect(dim.style.background).toBe(`rgba(0, 0, 0, ${6 / 16})`)
  })

  it('질문 창(0x74ef5)은 메뉴 덮개 대신 제 덮개 한 겹이다', () => {
    render(<InGameMenu mode={6} onContinue={vi.fn()} onRestart={vi.fn()} />)

    fireEvent.click(칸('재도전'))
    expect(screen.queryByTestId('경기-메뉴-어둡게')).toBeNull()
    expect(screen.getByRole('dialog').style.background).toBe(`rgba(0, 0, 0, ${6 / 16})`)
  })
})

describe('경기 중 메뉴 — 일시정지 창 0x741a0 의 여닫기 (2026-10-14 직접 뜸)', () => {
  function 높이를_잴_수_있게(height: number) {
    const 원래 = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => height })
    return () => {
      if (원래 === undefined) Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight')
      else Object.defineProperty(HTMLElement.prototype, 'offsetHeight', 원래)
    }
  }
  const 틀 = (n = 1) => act(() => vi.advanceTimersByTime(millisecondsPerFrame() * n))
  const 판 = () => screen.queryByTestId('경기-메뉴-판')

  /** 여는 곳 흉내 — `useInGameMenuState` 를 그대로 쓴다 */
  function 여는곳({
    onQuit,
    onRestart,
    mode = 6,
    gamePoint,
  }: {
    readonly onQuit?: () => void
    readonly onRestart?: () => void
    readonly mode?: number
    readonly gamePoint?: number
  }) {
    const menu = useInGameMenuState()
    return (
      <>
        <button type="button" onClick={menu.toggle}>
          별표
        </button>
        <span data-testid="열림">{String(menu.isOpen)}</span>
        {menu.isOpen && (
          <InGameMenu
            mode={mode}
            cursor={menu.cursor}
            onAutoProgress={vi.fn()}
            autoProgressCost={30}
            {...(gamePoint === undefined ? {} : { gamePoint })}
            onCursorChange={menu.setCursor}
            slidesIn={menu.slidesIn}
            opening={menu.opening}
            bindCloser={menu.bindCloser}
            onContinue={menu.close}
            {...(onQuit === undefined ? {} : { onQuit })}
            {...(onRestart === undefined ? {} : { onRestart })}
          />
        )}
      </>
    )
  }
  const 열림 = () => screen.getByTestId('열림').textContent

  let 되돌리기: () => void = () => {}
  afterEach(() => {
    되돌리기()
    vi.useRealTimers()
  })

  it("'*' 로 연 창은 [+0x290] = 0 — 연 그림은 펼침이라 판이 없고, 다음 갱신부터 그린다 (0x49936 · 0x7550a)", () => {
    vi.useFakeTimers()
    되돌리기 = 높이를_잴_수_있게(320)
    render(<여는곳 />)
    fireEvent.click(screen.getByText('별표'))
    expect(판()).toBeNull()
    틀()
    expect(판()).not.toBeNull()
  })

  it("'*' 로 연 창의 계속 · CLR 은 한 갱신 뒤에 닫힌다 — 그동안 메뉴가 그대로 남는다 (0x3c1a8 · 7550a~75552)", () => {
    vi.useFakeTimers()
    되돌리기 = 높이를_잴_수_있게(320)
    render(<여는곳 />)
    fireEvent.click(screen.getByText('별표'))
    틀()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(열림()).toBe('true')
    expect(판()).not.toBeNull()
    // 닫히는 동안 키는 안 본다
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    expect(고른칸()?.getAttribute('aria-label')).toBe('계속하기')
    틀()
    expect(열림()).toBe('false')
  })

  it('질문은 메뉴 창이 닫힌 갱신에 뜨고, [아니오] 뒤 다시 뜬 메뉴는 한 갱신 펼침 · 닫힘은 두 갱신 줄임이다 (0x7442d · 0x75440)', () => {
    vi.useFakeTimers()
    되돌리기 = 높이를_잴_수_있게(320)
    render(<여는곳 onRestart={vi.fn()} />)
    fireEvent.click(screen.getByText('별표'))
    틀()
    fireEvent.click(칸('재도전'))
    // 질문은 대기 칸 — 메뉴가 한 갱신 더 남는다
    expect(screen.queryByRole('button', { name: '아니오' })).toBeNull()
    expect(판()).not.toBeNull()
    틀()
    expect(판()).toBeNull()
    // 질문 창 펼침(10 → 20 → … → 목표) 뒤 [아니오]
    틀(6)
    fireEvent.click(아니오())
    // 경기 장면 [창+0x24e] = 1 — 줄임 없이 다음 갱신에 닫힌다
    틀()
    expect(screen.queryByRole('button', { name: '아니오' })).toBeNull()
    // 다시 뜬 메뉴([+0x290] = 1)는 한 갱신 펼침 동안 안 그린다
    expect(판()).toBeNull()
    틀()
    expect(판()).not.toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    틀()
    expect(열림()).toBe('true')
    expect(판()).not.toBeNull()
    틀()
    expect(열림()).toBe('false')
  })

  const 상자 = () => document.querySelector('[role="dialog"] > div') as HTMLElement

  it("'*' 로 연 창 뒤의 질문은 첫 그림이 이미 높이 20 이다 — 7550a~75552 → 0x75440 → 75556 펼침이 같은 갱신", () => {
    vi.useFakeTimers()
    되돌리기 = 높이를_잴_수_있게(320)
    render(<여는곳 onRestart={vi.fn()} />)
    fireEvent.click(screen.getByText('별표'))
    틀()
    fireEvent.click(칸('재도전'))
    틀()
    expect(상자().style.height).toBe('20px')
    틀()
    expect(상자().style.height).toBe('40px')
  })

  it('다시 띄운 창([+0x290] = 1) 뒤의 질문은 줄임 끝 0x75440 뒤 곧장 돌아가(755d8) 10 부터다', () => {
    vi.useFakeTimers()
    되돌리기 = 높이를_잴_수_있게(320)
    render(<여는곳 onRestart={vi.fn()} />)
    fireEvent.click(screen.getByText('별표'))
    틀()
    fireEvent.click(칸('재도전'))
    틀()
    틀(9)
    fireEvent.click(아니오())
    틀()
    틀(2)
    expect(판()).not.toBeNull()
    fireEvent.click(칸('재도전'))
    // 줄임 두 갱신(240 → 120 → 닫힘) 뒤 질문
    틀()
    틀()
    expect(상자().style.height).toBe('10px')
  })

  it('자동진행 [예] 뒤 G포인트 부족 알림(하위 2 0x3c7d8)은 닫힘 콜백이 없다 — 닫히면 메뉴 없이 경기로 돌아간다', () => {
    vi.useFakeTimers()
    되돌리기 = 높이를_잴_수_있게(320)
    render(<여는곳 mode={1} gamePoint={0} />)
    fireEvent.click(screen.getByText('별표'))
    틀()
    fireEvent.click(칸('자동진행'))
    틀()
    틀(9)
    fireEvent.click(예())
    틀()
    // 질문이 닫힌 갱신에 알림이 대기 칸에서 뜬다 — 앞 창이 줄임(폭 0)으로 닫혀 10 부터
    expect(screen.getByText(/자동진행을 할 수 없습니다/)).toBeTruthy()
    expect(상자().style.height).toBe('10px')
    틀(9)
    fireEvent.click(screen.getByRole('button', { name: '확인' }))
    틀()
    expect(screen.queryByText(/자동진행을 할 수 없습니다/)).toBeNull()
    expect(판()).toBeNull()
    expect(열림()).toBe('false')
  })
})
