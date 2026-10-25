import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SPEED_LEVEL, setGameSpeedLevel } from '@/shared/config/frameRate'
import { appTickOf } from '@/shared/lib/frameClock/frameClock'
import {
  clearGameSceneTimeout,
  createGameSceneDrawGate,
  gameSceneBackdropFreezeSerialNow,
  gameSceneNow,
  gameSceneTickNow,
  gameSceneTickOf,
  gameSceneTickStartTime,
  gameSceneTimeOf,
  isGameSceneFrozen,
  markCommonWindowShown,
  markGameSceneUp,
  resetCommonWindowShownForTest,
  setGameSceneTickTimeout,
  setGameSceneTimeout,
  markGameSceneLoading,
  rearmGameSceneFirstDraw,
} from '@/shared/lib/commonWindow/commonWindow'

/**
 * 경기 장면 0x52c50 — 공용 창 [0x140005c]+9 가 서 있으면 52cc6 이 갱신을, 52efe 가 상태 그리기를, 53048 이 파티클을 건너뛴다.
 * 장면 시계는 그동안 서고, 창이 닫히면 따라잡지 않고 이어 흐른다.
 */
describe('경기 장면 시계 — 공용 창 게이트 52cc6', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    resetCommonWindowShownForTest()
  })

  it('경기 장면이 없으면 창이 떠도 멈추지 않는다 — 다른 장면 프레임(0x32dd8 · 0xe9ac · 0x1cdec)에는 이 게이트가 없다', () => {
    vi.spyOn(performance, 'now').mockReturnValue(100)
    const release = markCommonWindowShown()
    expect(isGameSceneFrozen()).toBe(false)
    expect(gameSceneTimeOf(500)).toBe(500)
    release()
  })

  it('경기 장면 위에 창이 서 있는 동안 시계가 서고, 닫히면 멈춘 만큼 빼고 이어 흐른다', () => {
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(1000)
    const scene = markGameSceneUp()
    expect(gameSceneNow()).toBe(1000)
    now.mockReturnValue(1200)
    const window = markCommonWindowShown()
    expect(isGameSceneFrozen()).toBe(true)
    // 창이 떠 있는 동안 — 실제 시각이 흘러도 장면 시각은 창이 선 때에 서 있다
    expect(gameSceneTimeOf(1500)).toBe(1200)
    expect(gameSceneTimeOf(9000)).toBe(1200)
    now.mockReturnValue(5200)
    window()
    expect(isGameSceneFrozen()).toBe(false)
    // 4000ms 를 건너뛰고(따라잡지 않는다) 이어 흐른다
    expect(gameSceneTimeOf(5200)).toBe(1200)
    expect(gameSceneTimeOf(5300)).toBe(1300)
    scene()
  })

  it('창이 떠 있는 채로 경기 장면이 서면 그때부터 멈춘다', () => {
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(0)
    const window = markCommonWindowShown()
    now.mockReturnValue(300)
    const scene = markGameSceneUp()
    expect(isGameSceneFrozen()).toBe(true)
    expect(gameSceneTimeOf(800)).toBe(300)
    now.mockReturnValue(1300)
    window()
    expect(gameSceneTimeOf(1400)).toBe(400)
    scene()
  })
})

describe('경기 장면 시계 setTimeout — 상태 길이는 창 아래에서 서고 닫히면 남은 만큼만 더 기다린다(52cc6)', () => {
  afterEach(() => {
    vi.useRealTimers()
    resetCommonWindowShownForTest()
  })

  it('멈춘 동안 붙잡고, 풀리면 남은 시간만 더 잰다', () => {
    vi.useFakeTimers()
    const scene = markGameSceneUp()
    const fired = vi.fn()
    setGameSceneTimeout(fired, 300)
    vi.advanceTimersByTime(100)
    const window = markCommonWindowShown()
    vi.advanceTimersByTime(5_000)
    expect(fired).not.toHaveBeenCalled()
    window()
    vi.advanceTimersByTime(199)
    expect(fired).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fired).toHaveBeenCalledTimes(1)
    scene()
  })

  it('멈춘 동안 건 시계는 풀린 때부터 잰다 · 거두면 울리지 않는다', () => {
    vi.useFakeTimers()
    const scene = markGameSceneUp()
    const window = markCommonWindowShown()
    const fired = vi.fn()
    const cleared = vi.fn()
    setGameSceneTimeout(fired, 50)
    const id = setGameSceneTimeout(cleared, 50)
    vi.advanceTimersByTime(1_000)
    window()
    clearGameSceneTimeout(id)
    vi.advanceTimersByTime(49)
    expect(fired).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fired).toHaveBeenCalledTimes(1)
    expect(cleared).not.toHaveBeenCalled()
    scene()
  })

  it('경기 장면이 아니면 창이 떠도 그냥 흐른다', () => {
    vi.useFakeTimers()
    const window = markCommonWindowShown()
    const fired = vi.fn()
    setGameSceneTimeout(fired, 100)
    vi.advanceTimersByTime(100)
    expect(fired).toHaveBeenCalledTimes(1)
    window()
  })
})

describe('창이 선 첫 그림 — 52efe [창+0x250] 이면 갱신 없이도 그리기가 한 번 돈다', () => {
  afterEach(() => resetCommonWindowShownForTest())

  it('멈출 때마다 부품마다 한 번만 그린다', () => {
    const scene = markGameSceneUp()
    const gate = createGameSceneDrawGate()
    const other = createGameSceneDrawGate()
    expect(gate.allowsDraw()).toBe(true)
    const first = markCommonWindowShown()
    expect(gate.allowsDraw()).toBe(true)
    expect(gate.allowsDraw()).toBe(false)
    expect(other.allowsDraw()).toBe(true)
    expect(other.allowsDraw()).toBe(false)
    // 웹이 한 창을 둘로 겹쳐 세는 동안(같은 멈춤)은 다시 그리지 않는다
    const overlapped = markCommonWindowShown()
    first()
    expect(gate.allowsDraw()).toBe(false)
    // 대기 칸 창이 이어 선다 — 창 갱신 0x754f8(75552 · 755d4) → 0x75440 이 0x74ef4 · 0x741a0 으로 다음 창을 띄워 [+0x250] 을
    // 다시 세운다. 웹은 앞 창이 내려가고 같은 때 다음 창이 선다 — 그 첫 그림이 또 돈다
    overlapped()
    const third = markCommonWindowShown()
    expect(gate.allowsDraw()).toBe(true)
    expect(gate.allowsDraw()).toBe(false)
    // 멈춘 동안 만든 부품은 그 멈춤의 첫 그림을 지난 것으로 본다
    expect(createGameSceneDrawGate().allowsDraw()).toBe(false)
    third()
    scene()
  })
})

describe('창 첫 그림의 배경 0x41230 — 로딩 판(상태 7 · 8 · 9)에서는 안 그린다(52f26~52f36)', () => {
  afterEach(() => resetCommonWindowShownForTest())

  it('로딩 판이 서 있는 동안 선 창은 배경 다시 그리기 수에 안 든다', () => {
    const scene = markGameSceneUp()
    const start = gameSceneBackdropFreezeSerialNow()
    const loading = markGameSceneLoading()
    const duringLoading = markCommonWindowShown()
    expect(isGameSceneFrozen()).toBe(true)
    expect(gameSceneBackdropFreezeSerialNow()).toBe(start)
    duringLoading()
    loading()
    const afterLoading = markCommonWindowShown()
    expect(gameSceneBackdropFreezeSerialNow()).toBe(start + 1)
    afterLoading()
    scene()
  })
})

describe('경기 장면 틱 — 장면 시계를 한 틱 격자로 센 정수(0x52c50 한 틀 = 한 틱)', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    resetCommonWindowShownForTest()
  })

  it('장면 시각을 62ms 격자로 센다 · 창이 떠 있는 동안 서고 닫히면 그 틱에서 이어 오른다', () => {
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(1000)
    expect(gameSceneTickNow()).toBe(16)
    const 장면 = markGameSceneUp()
    const 창 = markCommonWindowShown()
    now.mockReturnValue(5000)
    expect(gameSceneTickNow()).toBe(16)
    창()
    // 4000ms 를 뺀 장면 시각 1000 → 그대로 16, 62ms 더 흐르면 17
    expect(gameSceneTickNow()).toBe(16)
    now.mockReturnValue(5000 + 62)
    expect(gameSceneTickNow()).toBe(17)
    expect(gameSceneTickOf(gameSceneTimeOf(5000 + 62))).toBe(17)
    // 장면 틱 머리는 앱 틱 머리다 — 멈춘 앱 틱 64 개(틱 16 → 80)를 빼 장면 틱 17 = 앱 틱 81(5022ms), 장면 시각으로 1022
    expect(gameSceneTickStartTime(17)).toBe(81 * 62 - 4000)
    장면()
  })

  it('장면 틱은 앱 틱 격자 위에 선다 — 창이 닫힌 앱 틱 안에서는 멈춘 틱 그대로, 다음 앱 틱 머리에서 하나 오른다', () => {
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(1000) // 앱 틱 16 (992~1053)
    const 장면 = markGameSceneUp()
    const 창 = markCommonWindowShown()
    now.mockReturnValue(5000) // 앱 틱 80 (4960~5021)
    창()
    expect(gameSceneTickNow()).toBe(16)
    now.mockReturnValue(5021)
    expect(gameSceneTickNow()).toBe(16)
    now.mockReturnValue(5022) // 앱 틱 81 머리
    expect(gameSceneTickNow()).toBe(17)
    expect(appTickOf(5022) - gameSceneTickNow()).toBe(64)
    장면()
  })

  it('창이 떠 있는 동안 속도를 바꿔도 장면 틱은 앱 틱과 같은 기준점으로 센다', () => {
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(1000) // 앱 틱 16
    const 장면 = markGameSceneUp()
    const 창 = markCommonWindowShown()
    now.mockReturnValue(2000) // 앱 틱 32 (1984~2045)
    setGameSpeedLevel(0) // 250ms — 바뀐 그 순간 앱 틱 32 머리(1984)부터 새 길이
    now.mockReturnValue(2300) // 앱 틱 33 (2234~2483)
    창()
    expect(gameSceneTickNow()).toBe(16)
    now.mockReturnValue(2484) // 앱 틱 34 머리
    expect(gameSceneTickNow()).toBe(17)
    expect(appTickOf(2484) - gameSceneTickNow()).toBe(appTickOf(2300) - 16)
    setGameSpeedLevel(DEFAULT_SPEED_LEVEL)
    장면()
  })

  it('틱으로 건 setTimeout 은 창이 닫힌 뒤에도 앱 틱 머리에 울린다', () => {
    vi.useFakeTimers()
    const now = vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
    vi.setSystemTime(1000) // 앱 틱 16
    const 장면 = markGameSceneUp()
    const 울림 = vi.fn()
    setGameSceneTickTimeout(울림, 2) // 장면 틱 18
    const 창 = markCommonWindowShown()
    vi.advanceTimersByTime(4000) // 5000 — 앱 틱 80
    창()
    // 장면 틱 18 = 앱 틱 82 머리(5084)
    vi.advanceTimersByTime(83)
    expect(울림).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(울림).toHaveBeenCalledTimes(1)
    now.mockRestore()
    장면()
  })

  it('틱으로 거는 setTimeout 은 끝을 틱 머리에 맞춘다 — 건 때가 틱 안쪽이어도', () => {
    vi.useFakeTimers()
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(100) // 틱 1 (62~123) 안쪽
    const 울림 = vi.fn()
    setGameSceneTickTimeout(울림, 2)
    // 틱 3 머리 = 186 → 86ms 뒤
    vi.advanceTimersByTime(85)
    expect(울림).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(울림).toHaveBeenCalledTimes(1)
  })
})

describe('단말 일시정지 0x2da0 → 0x74458 — 창이 선 첫 그림을 다시 세운다([창+0x250] = 1)', () => {
  afterEach(() => resetCommonWindowShownForTest())

  it('경기 장면에 창이 서 있으면 다음 그림이 장면 · 배경을 한 번 더 그린다 — 창이 없으면 아무 일 없다', () => {
    const scene = markGameSceneUp()
    const gate = createGameSceneDrawGate()
    const backdrop = gameSceneBackdropFreezeSerialNow()
    rearmGameSceneFirstDraw()
    expect(gameSceneBackdropFreezeSerialNow()).toBe(backdrop)
    const window = markCommonWindowShown()
    expect(gate.allowsDraw()).toBe(true)
    expect(gate.allowsDraw()).toBe(false)
    rearmGameSceneFirstDraw()
    expect(gate.allowsDraw()).toBe(true)
    expect(gate.allowsDraw()).toBe(false)
    expect(gameSceneBackdropFreezeSerialNow()).toBe(backdrop + 2)
    window()
    scene()
  })
})
