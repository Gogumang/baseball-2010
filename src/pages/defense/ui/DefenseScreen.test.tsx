// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { DefenseScreen } from '@/pages/defense/ui/DefenseScreen'
import {
  DEFENSE_BACKGROUND_WIDTH,
  defenderPaletteIndexOf,
  FIELDER_ACTION,
  RUNNER_ACTION,
  type DefenseViewState,
} from '@/pages/defense/lib/defenseView'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/**
 * 수비 화면 (R3-field-view 1~6절).
 * 진입 때 카메라가 대상에 즉시 맞으므로(vt10 0x466d0), 멈춘 채 띄우면
 * 배치가 카메라 순수 함수 값 그대로다 — 여기서 확인하는 것이 그 배치다.
 */

afterEach(cleanup)

/** 투수판 (20000, 24500) 을 보는 스냅샷 — 카메라는 (12259, 11700), 오프셋은 (−190, −180) */
const 기본_상태: DefenseViewState = {
  ball: { x: 20000, z: 24500, height: 0, isFlying: true },
  fielders: [{ slot: 0, x: 20000, z: 24500, action: FIELDER_ACTION.stand, actionTick: 0 }],
  runners: [],
}

const 띄우기 = (state: DefenseViewState = 기본_상태) =>
  render(<DefenseScreen state={state} isRunning={false} />)

describe('수비 배경', () => {
  it('310 폭 두 장으로 620×500 을 만든다 — 오른쪽은 좌우 반전이다', () => {
    띄우기()
    const left = screen.getByTestId('defense-background-left')
    const right = screen.getByTestId('defense-background-right')

    expect(left.style.left).toBe('-190px')
    expect(left.style.top).toBe('-180px')
    expect(left.style.width).toBe(`${DEFENSE_BACKGROUND_WIDTH}px`)
    expect(right.style.left).toBe(`${-190 + DEFENSE_BACKGROUND_WIDTH}px`)
    expect(right.className).not.toBe(left.className)
  })
})

describe('월드 좌표 → 화면 좌표', () => {
  it('카메라가 보는 점은 화면 가로 한가운데(120)에 온다', () => {
    띄우기()
    const pitcher = screen.getByTestId('defense-fielder-0')

    expect(pitcher.style.left).toBe('120px')
    expect(pitcher.style.top).toBe('196px')
  })

  it('1루 쪽(x 큰 쪽) 야수는 오른쪽에 놓인다', () => {
    띄우기({
      ...기본_상태,
      fielders: [
        ...기본_상태.fielders,
        { slot: 2, x: 25068, z: 23275, action: FIELDER_ACTION.runRight, actionTick: 1 },
      ],
    })

    const first = screen.getByTestId('defense-fielder-2')
    expect(Number.parseInt(first.style.left, 10)).toBeGreaterThan(120)
    // 달리기 → 동작 4 · 칸 1 = vt40 날값 10 에 +17 한 프레임 27 (R3 2-1 · S12 8-1)
    expect(first.dataset.frame).toBe('27')
  })

  it('공은 높이만큼 위로 올라간다 — 그림자는 땅점에 남는다', () => {
    // 카메라를 못 박아 둬야 높이만 비교된다 (안 박으면 대상이 z−높이라 카메라도 같이 움직인다)
    const 고정_카메라 = { x: 20000, z: 24500 }
    const 공 = (height: number): DefenseViewState => ({
      ...기본_상태,
      ball: { x: 20000, z: 24500, height, isFlying: true },
      cameraTarget: 고정_카메라,
    })

    띄우기(공(0))
    const 바닥 = Number.parseInt(screen.getByTestId('defense-ball').style.top, 10)
    // 땅 공(화면 높이 0)의 그림자는 s = 5 — 검정 6×6 은 땅점에서 (−2, −2)
    const 땅그림자 = screen.getAllByTestId('defense-ball-shadow')[0]
    expect(땅그림자.style.width).toBe('6px')
    expect(Number.parseInt(땅그림자.style.top, 10)).toBe(바닥 - 2)

    cleanup()
    띄우기(공(6500))
    const 띄운 = Number.parseInt(screen.getByTestId('defense-ball').style.top, 10)

    // 6500 월드 = 6500 × 500 / 32500 = 100px
    expect(바닥 - 띄운).toBe(100)
    // 그림자는 공을 따라 오르지 않는다 — 공중 공은 s = 3, 검정 4×4 가 땅점에서 (−1, −1)
    const 공중그림자 = screen.getAllByTestId('defense-ball-shadow')[0]
    expect(공중그림자.style.width).toBe('4px')
    expect(Number.parseInt(공중그림자.style.top, 10)).toBe(바닥 - 1)
  })
})

describe('카메라 — 진입 맞춤 0x46418 · 멈춤 0x3f060(3f0a4 경기 멈춤 · 3f0b8 관문 G1)', () => {
  /** 투수판에 맞춘 뒤 대상을 1루 쪽으로 옮겨 갱신 몇 번을 흘린다 — 투수 그림이 화면에서 얼마나 밀렸나 */
  const 흘린_뒤_투수_x = (cameraFrozen: boolean): number => {
    vi.useFakeTimers()
    try {
      const view = render(<DefenseScreen state={{ ...기본_상태, cameraTarget: { x: 20000, z: 24500 } }} />)
      view.rerender(
        <DefenseScreen state={{ ...기본_상태, cameraTarget: { x: 26000, z: 24500 }, cameraFrozen }} />,
      )
      for (let i = 0; i < 5; i += 1) act(() => void vi.advanceTimersByTime(millisecondsPerFrame()))
      return Number.parseInt(screen.getByTestId('defense-fielder-0').style.left, 10)
    } finally {
      vi.useRealTimers()
    }
  }

  it('진입 맞춤(466e0~46708)은 공 (x, z) 다 — 높이를 안 뺀다', () => {
    띄우기({ ...기본_상태, ball: { x: 20000, z: 24500, height: 6500, isFlying: true } })
    // 높이를 뺐다면 카메라가 100px 위를 봐 투수가 296 에 놓였을 것이다
    expect(screen.getByTestId('defense-fielder-0').style.top).toBe('196px')
  })

  it('멈춘 그림에서는 대상이 바뀌어도 카메라가 그 자리에 선다', () => {
    expect(흘린_뒤_투수_x(true)).toBe(120)
  })

  it('안 멈춘 그림이면 따라간다 — 투수가 왼쪽으로 밀린다', () => {
    expect(흘린_뒤_투수_x(false)).toBeLessThan(120)
  })
})

describe('그리기 목록 차례 0xbe810 (키 오름차순 · 같은 키는 먼저 넣은 것 뒤)', () => {
  const 차례 = (): string[] =>
    Array.from(screen.getByTestId('defense-zoom').querySelectorAll('[data-testid]'))
      .map((node) => node.getAttribute('data-testid') ?? '')
      .filter((id) => /^defense-(fielder|runner|ball)/.test(id) && id !== 'defense-ball-shadow')

  it('야수 z · 주자 z + 1 · 공 z 오름차순이다 — 홈 쪽이 위', () => {
    띄우기({
      ...기본_상태,
      ball: { x: 20000, z: 26000, height: 0, isFlying: true },
      fielders: [
        { slot: 0, x: 20000, z: 24500, action: FIELDER_ACTION.stand, actionTick: 0 },
        { slot: 8, x: 20000, z: 15000, action: FIELDER_ACTION.stand, actionTick: 0 },
        { slot: 1, x: 20000, z: 30000, action: FIELDER_ACTION.stand, actionTick: 0 },
      ],
      runners: [{ index: 0, x: 21000, z: 24500, action: RUNNER_ACTION.run, actionTick: 0, base: 1, isAdvancing: true }],
    })
    expect(차례()).toEqual([
      'defense-fielder-8',
      'defense-fielder-0',
      'defense-runner-0',
      'defense-ball',
      'defense-fielder-1',
    ])
  })

  it('같은 키면 먼저 넣은 것이 아래다 — 야수는 칸 8 → 0 차례로 넣고, 공은 맨 나중에 넣는다', () => {
    띄우기({
      ...기본_상태,
      ball: { x: 20000, z: 24500, height: 0, isFlying: true },
      fielders: [
        { slot: 3, x: 21000, z: 24500, action: FIELDER_ACTION.stand, actionTick: 0 },
        { slot: 5, x: 19000, z: 24500, action: FIELDER_ACTION.stand, actionTick: 0 },
      ],
    })
    expect(차례()).toEqual(['defense-fielder-5', 'defense-fielder-3', 'defense-ball'])
  })
})

describe('비거리 판 자리 (0x46cb6 — 그리기 목록보다 먼저)', () => {
  it('줌 층 안, 공 그림자 뒤 · 야수 앞에 깐다', () => {
    render(<DefenseScreen state={기본_상태} isRunning={false} underActors={<div data-testid="아래판" />} />)
    const 줌 = screen.getByTestId('defense-zoom')
    const ids = Array.from(줌.querySelectorAll('[data-testid]')).map((node) => node.getAttribute('data-testid'))
    const 판 = ids.indexOf('아래판')
    expect(판).toBeGreaterThan(ids.lastIndexOf('defense-ball-shadow'))
    expect(판).toBeLessThan(ids.indexOf('defense-fielder-0'))
  })
})

describe('공을 안 그리는 그림 (0x36dfc 36e86~36ea4)', () => {
  it('쥔 공(+0x12c)은 안 그린다 — 그림자도 없다', () => {
    띄우기({ ...기본_상태, ball: { ...기본_상태.ball, isHeld: true } })
    expect(screen.queryByTestId('defense-ball')).toBeNull()
    expect(screen.queryByTestId('defense-ball-shadow')).toBeNull()
  })

  it('담장 뒤로 사라진 공은 안 그린다', () => {
    띄우기({ ...기본_상태, ball: { ...기본_상태.ball, isBeyondFence: true } })
    expect(screen.queryByTestId('defense-ball')).toBeNull()
  })

  it('그 밖은 그린다', () => {
    띄우기()
    expect(screen.getByTestId('defense-ball')).toBeTruthy()
  })
})

describe('주자와 번쩍임', () => {
  it('주자는 동작 표대로 그리고, 안 보이는 주자는 빠진다', () => {
    띄우기({
      ...기본_상태,
      runners: [
        { index: 0, x: 22000, z: 26000, action: RUNNER_ACTION.slide, actionTick: 0, base: 1, isAdvancing: true },
        { index: 1, x: 25946, z: 24500, action: RUNNER_ACTION.run, actionTick: 0, base: 1, isAdvancing: true, isVisible: false },
      ],
    })

    // 슬라이딩 · 루 1 · 진루 → 13 + 표[1] = 16 (R3 8-1)
    expect(screen.getByTestId('defense-runner-0').dataset.frame).toBe('16')
    expect(screen.queryByTestId('defense-runner-1')).toBeNull()
  })

  it('번쩍임 B 는 공보다 50px 위에 놓인다 (R2 2절)', () => {
    띄우기({ ...기본_상태, flash: { kind: 'b', step: 2 } })

    const ball = screen.getByTestId('defense-ball')
    const flash = screen.getByTestId('defense-flash')
    expect(Number.parseInt(flash.style.top, 10)).toBe(Number.parseInt(ball.style.top, 10) - 50)
  })

  it('번쩍임이 없으면 그리지 않는다', () => {
    띄우기()
    expect(screen.queryByTestId('defense-flash')).toBeNull()
  })

  it('번쩍임에 점(공 가진 야수 x · z − y)이 실려 오면 그 자리에 놓는다 — C 는 방향 0x12 면 x + 10', () => {
    띄우기({ ...기본_상태, flash: { kind: 'c', step: 0, direction: 0x12, x: 20000, z: 24500 } })

    const pitcher = screen.getByTestId('defense-fielder-0')
    const flash = screen.getByTestId('defense-flash')
    expect(Number.parseInt(flash.style.left, 10)).toBe(Number.parseInt(pitcher.style.left, 10) + 10)
    expect(flash.style.top).toBe(pitcher.style.top)
  })

  it('결과 판의 보통 판정 글자는 공 가진 야수 자리에서 30 위 + dy (0x46844 → 0x393b4)', () => {
    띄우기({ ...기본_상태, judgeText: { frame: 6, dx: 0, dy: 3, holderSlot: 0 } })

    const pitcher = screen.getByTestId('defense-fielder-0')
    const text = screen.getByTestId('defense-judge-text')
    expect(text.dataset.frame).toBe('6')
    expect(text.style.left).toBe(pitcher.style.left)
    expect(Number.parseInt(text.style.top, 10)).toBe(Number.parseInt(pitcher.style.top, 10) - 30 + 3)
  })

  it('자리 야수가 −1(없음)이면 화면 가운데에 그린다 (46866)', () => {
    띄우기({ ...기본_상태, judgeText: { frame: 8, dx: 0, dy: 0, holderSlot: -1 } })

    const text = screen.getByTestId('defense-judge-text')
    expect(text.style.left).toBe('120px')
  })
})

describe('좌·우 그림 (S12 8절 — 좌우 반전이 아니다)', () => {
  it('야수는 뒤집지 않고 동작 3·4 의 다른 프레임 묶음으로 좌·우를 가른다', () => {
    띄우기({
      ...기본_상태,
      fielders: [
        { slot: 0, x: 20000, z: 24500, action: FIELDER_ACTION.runLeft, actionTick: 0 },
        { slot: 1, x: 20000, z: 29705, action: FIELDER_ACTION.runRight, actionTick: 0 },
      ],
    })

    const 왼 = screen.getByTestId('defense-fielder-0')
    const 오 = screen.getByTestId('defense-fielder-1')
    // 프레임은 vt40 날값 6·9 에 +17 을 더한 23·26 이고, 뒤집기 클래스는 붙지 않는다
    expect(왼.dataset.frame).toBe('23')
    expect(오.dataset.frame).toBe('26')
    expect(왼.className.split(' ')).toHaveLength(1)
    expect(오.className.split(' ')).toEqual(왼.className.split(' '))
  })
})

/**
 * 팀 15색 팔레트 (C-1).
 *
 * ⚠️ jsdom 에는 canvas 도 그림 적재도 없다 — 교체 엔진은 조용히 **구운 그림**을 그대로 내놓는다.
 * 그래서 여기서는 `<img src>` 가 이번 프레임의 구운 주소인지, 그리고 프레임이 바뀔 때
 * 그림이 **새로 마운트되는지**만 본다(색이 실제로 바뀌는 것은 브라우저 쪽 눈 확인).
 * 원점(`origins.json`)·팔레트 표는 fetch 를 가짜로 세워 준다.
 */
describe('팀 팔레트로 다시 칠하기', () => {
  const 원점들 = Object.fromEntries(
    Array.from({ length: 125 }, (_, frame) => [
      String(frame).padStart(3, '0'),
      { x: -7, y: -20, width: 15, height: 21 },
    ]),
  )
  const 팔레트표 = { mpl: 'defender.mpl', select: '팀', baked: 2, colors: [], palettes: [] }

  let 원래_fetch: typeof globalThis.fetch | undefined

  beforeEach(() => {
    원래_fetch = globalThis.fetch
    globalThis.fetch = ((url: string) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(url.endsWith('palette.json') ? 팔레트표 : 원점들),
      })) as unknown as typeof globalThis.fetch
  })
  afterEach(() => {
    if (원래_fetch === undefined) delete (globalThis as { fetch?: unknown }).fetch
    else globalThis.fetch = 원래_fetch
  })

  const 야수 = (action: number, teamIndex: number | null) => ({
    ...기본_상태,
    fielders: [{ slot: 0, x: 20000, z: 24500, action, actionTick: 0, teamIndex }],
  })
  const 그림 = () => screen.getByTestId('defense-fielder-0').querySelector('img')

  it('팀 번호를 주면 defender 그림을 칠해서 내놓는다 (jsdom 에선 구운 그림 그대로)', async () => {
    띄우기(야수(FIELDER_ACTION.stand, 7))
    await act(async () => {})

    // 제자리 동작 = vt40 날값 0 + 17 = 프레임 017
    expect(그림()?.getAttribute('src')).toBe('./sprites/defender/frames/017.png')
  })

  it('팀 번호를 안 주면 지금까지처럼 맨 그림을 쓴다', async () => {
    띄우기(야수(FIELDER_ACTION.stand, null))
    await act(async () => {})

    expect(그림()?.getAttribute('src')).toBe('./sprites/defender/frames/017.png')
  })

  it('⚠️ 프레임이 바뀌면 그림을 새로 마운트한다 — 칠한 주소가 한 박자 늦는 함정 때문이다', async () => {
    const { rerender } = render(<DefenseScreen state={야수(FIELDER_ACTION.stand, 7)} isRunning={false} />)
    await act(async () => {})
    const 먼저 = 그림()

    rerender(<DefenseScreen state={야수(FIELDER_ACTION.throw, 7)} isRunning={false} />)
    await act(async () => {})
    const 나중 = 그림()

    // 송구 동작 = 날값 12 + 17 = 프레임 029
    expect(나중?.getAttribute('src')).toBe('./sprites/defender/frames/029.png')
    // 같은 자리인데 **다른 DOM 마디**여야 한다 (key = 프레임 → 새로 마운트)
    expect(나중).not.toBe(먼저)
  })

  it('마선수 그림은 팀 색을 안 탄다 — 제 그림판을 그대로 쓴다', async () => {
    띄우기({
      ...기본_상태,
      fielders: [
        { slot: 4, x: 20000, z: 24500, action: FIELDER_ACTION.stand, actionTick: 0, teamIndex: 7, aceIndex: 0 },
      ],
    })
    await act(async () => {})

    const 마선수 = screen.getByTestId('defense-fielder-4').querySelector('img')
    expect(마선수?.getAttribute('src')).toBe('./sprites/defender_medica/frames/017.png')
  })

  it('주자도 같은 팔레트 표를 타되 공격 팀 번호를 쓴다', async () => {
    띄우기({
      ...기본_상태,
      runners: [
        { index: 0, x: 22000, z: 26000, action: RUNNER_ACTION.stand, actionTick: 0, base: 1, isAdvancing: true, teamIndex: 3 },
      ],
    })
    await act(async () => {})

    expect(screen.getByTestId('defense-runner-0').querySelector('img')?.getAttribute('src')).toBe(
      './sprites/defender/frames/000.png',
    )
  })

  it('팀 번호 → 팔레트 벌 번호는 팀 번호 그대로다 (수비수 .mpl 은 피부가 없다)', () => {
    expect(defenderPaletteIndexOf(0)).toBe(0)
    expect(defenderPaletteIndexOf(14)).toBe(14)
    expect(defenderPaletteIndexOf(15)).toBeNull()
    expect(defenderPaletteIndexOf(-1)).toBeNull()
    expect(defenderPaletteIndexOf(null)).toBeNull()
    expect(defenderPaletteIndexOf(undefined)).toBeNull()
  })
})

/** 레이저 송구 반짝임 — 0x43278 의 0x43406~0x4342c (I-controls 1c 끝 · R2 2절) */
describe('레이저 송구 반짝임', () => {
  const 야수둘: DefenseViewState = {
    ...기본_상태,
    fielders: [
      ...기본_상태.fielders,
      { slot: 6, x: 30700, z: 12300, action: FIELDER_ACTION.stand, actionTick: 0 },
    ],
  }

  it('칸을 안 주면 아무도 안 반짝인다', () => {
    띄우기(야수둘)

    expect(screen.getByTestId('defense-fielder-0').dataset.laserShining).toBeUndefined()
    expect(screen.getByTestId('defense-fielder-6').dataset.laserShining).toBeUndefined()
  })

  it('공 쥔 야수 **한 명만** 빨갛게 그린다', () => {
    띄우기({ ...야수둘, laserShiningSlot: 6 })

    expect(screen.getByTestId('defense-fielder-6').dataset.laserShining).toBe('true')
    expect(screen.getByTestId('defense-fielder-0').dataset.laserShining).toBeUndefined()
    // 색만 바뀐다 — 그림(프레임)은 그대로다
    expect(screen.getByTestId('defense-fielder-6').dataset.frame).toBe('17')
  })

  it('deadly_effect 번쩍임과 다른 표시다 — 반짝여도 공 자리에는 아무것도 안 뜬다', () => {
    띄우기({ ...야수둘, laserShiningSlot: 6 })

    expect(screen.queryByTestId('defense-flash')).toBeNull()
  })
})

describe('작은 지도 0x395f4 (0x46e02 — 앵커 (30, 30))', () => {
  const 주자 = (index: number, x: number, z: number, isFinished = false) => ({
    index, x, z, action: RUNNER_ACTION.stand, actionTick: 0, base: 0, isAdvancing: false, isFinished,
  })

  it('처리 끝(+0x96) 아닌 주자만 점을 찍는다 — 카메라와 상관없이 화면 좌표', () => {
    띄우기({ ...기본_상태, runners: [주자(0, 25946, 24175), 주자(1, 20000, 19170, true)] })
    expect(screen.getByTestId('defense-field-map')).toBeTruthy()
    const dots = screen.getAllByTestId('defense-field-map-dot')
    expect(dots).toHaveLength(1)
    // 1루 = 중심 (30 + 23, 30 + 2) 에서 (6, 5) 당김
    expect(dots[0]!.style.left).toBe('47px')
    expect(dots[0]!.style.top).toBe('27px')
    expect(dots[0]!.style.opacity).toBe('0.75')
  })
})
