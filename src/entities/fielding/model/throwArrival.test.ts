import { describe, expect, it } from 'vitest'
import { basePosition, runnerSpeedOf } from '@/entities/fielding/model/fieldGeometry'
import {
  createFielders,
  createRunner,
  initialPlayView,
  NONE,
  type DefenseContext,
  type FielderState,
  type PlayView,
} from '@/entities/fielding/model/fieldingState'
import {
  autoThrowTargetBase,
  defenseArrivalTicks,
  secondBaseCoverSlot,
  secondBaseHelperPlacement,
  shouldReleaseThrow,
} from '@/entities/fielding/model/throwArrival'

const 야수들 = createFielders(Array.from({ length: 9 }, () => 500))

const 문맥 = (play: Partial<PlayView>, overrides: Partial<DefenseContext> = {}): DefenseContext => ({
  play: { ...initialPlayView(1), ...play },
  fielders: 야수들,
  runners: [],
  currentTick: 0,
  landingTick: 30,
  ...overrides,
})

describe('0xaf284 — 커버가 없을 때는 "직접 뛰기 vs 루 담당 야수 도착" 중 빠른 쪽', () => {
  it('2루수가 잡았고 1루에 커버가 없으면 1루수(칸 2)가 루에 닿는 5틱 이 이긴다', () => {
    const 문 = 문맥({ ballHolderSlot: 3, catchFielderSlot: 3 })
    expect(defenseArrivalTicks(문, 1)).toBe(5)
  })

  it('루 담당 야수가 이미 그 루를 목표로 하고 있으면 더 뛰지 않는다', () => {
    const 야수 = 야수들.map((fielder, slot) =>
      slot === 2 ? { ...fielder, targetBase: 1, target: basePosition(1) } : fielder,
    )
    const 문 = 문맥({ ballHolderSlot: 3, catchFielderSlot: 3 }, { fielders: 야수 })
    expect(defenseArrivalTicks(문, 1)).toBe(5)
  })
})

describe('0xaf284 — 커버가 있으면 "남은 틱 + max(송구 + 준비, 커버 도착 − 남은 틱)"', () => {
  it('아직 안 잡은 내야 송구: 남은 6 + (송구 5 + 준비 3) = 14', () => {
    const 문 = 문맥(
      { ballHolderSlot: 3, catchFielderSlot: 3, coverOfBase: [NONE, 2, NONE, NONE], catchTick: 10 },
      { currentTick: 4 },
    )
    expect(defenseArrivalTicks(문, 1)).toBe(14)
  })

  it('이미 잡았으면 준비 틱 대신 진행 중인 동작의 남은 틱(+0xc8)이 붙는다', () => {
    const 야수: readonly FielderState[] = 야수들.map((fielder, slot) =>
      slot === 3 ? { ...fielder, holdingBall: true, actionRemainingTicks: 2 } : fielder,
    )
    const 문 = 문맥(
      { ballHolderSlot: 3, catchFielderSlot: 3, coverOfBase: [NONE, 2, NONE, NONE], catchTick: 10 },
      { fielders: 야수, currentTick: 4 },
    )
    expect(defenseArrivalTicks(문, 1)).toBe(7) // 송구 5 + 동작 2
  })

  it('외야에서 17000 이상이면 중계가 끼고 준비 틱도 6 이 된다 — 중계 30 + 준비 6 = 36', () => {
    const 문 = 문맥({
      ballHolderSlot: 8,
      catchFielderSlot: 8,
      coverOfBase: [1, NONE, NONE, NONE],
      catchTick: 0,
    })
    expect(defenseArrivalTicks(문, 0)).toBe(36)
  })

  it('커버 야수가 루에서 멀면 그 도착 틱이 하한이 된다', () => {
    const 야수 = 야수들.map((fielder, slot) =>
      slot === 2 ? { ...fielder, position: { x: 25_068, y: 0, z: 8_000 } } : fielder,
    )
    const 문 = 문맥(
      {
        ballHolderSlot: 3,
        catchFielderSlot: 3,
        coverOfBase: [NONE, 2, NONE, NONE],
        catchTick: 0,
      },
      { fielders: 야수 },
    )
    // 커버가 1루까지 뛰는 데 걸리는 틱이 송구 틱보다 크다
    expect(defenseArrivalTicks(문, 1)).toBeGreaterThan(20)
  })
})

describe('AI 상태 9 — 송구 타이밍 게이트 (0xb4838)', () => {
  it('받을 야수가 루에 늦게 닿으면 이번 틱에는 안 던진다', () => {
    const 먼커버: FielderState = {
      ...야수들[2],
      position: { x: 25_068, y: 0, z: 8_000 },
      target: basePosition(1),
    }
    expect(shouldReleaseThrow(먼커버, 야수들[3], 1)).toBe(false)
  })

  it('루에 도착해 있으면 던진다', () => {
    const 붙은커버: FielderState = { ...야수들[2], position: basePosition(1), target: basePosition(1) }
    expect(shouldReleaseThrow(붙은커버, 야수들[3], 1)).toBe(true)
  })
})

describe('사람 쪽 자동 송구 목표 0xb1c90 — 앞선 주자부터', () => {
  it('사람이 고른 목표가 있으면 그대로 쓴다', () => {
    const 문 = 문맥({ manualThrowBase: 2 })
    expect(autoThrowTargetBase(문)).toBe(2)
  })

  it('주자 도착 틱이 송구 시간보다 크거나 같은 첫 루를 고른다', () => {
    const 느린주자 = createRunner(1, 1, runnerSpeedOf(0), { targetBase: 2 })
    const 문 = 문맥(
      { ballHolderSlot: 3, catchFielderSlot: 3, coverOfBase: [NONE, NONE, 5, NONE] },
      { runners: [느린주자] },
    )
    expect(autoThrowTargetBase(문)).toBe(2)
  })

  it('고리에는 커버 검사가 없다 — 커버 없는 3루도 잡을 수 있으면 고른다 (b1f7a~b2038)', () => {
    const 이루주자 = createRunner(2, 2, runnerSpeedOf(0), { targetBase: 3 })
    const 일루주자 = createRunner(1, 1, runnerSpeedOf(0), { targetBase: 2 })
    const 문 = 문맥(
      { ballHolderSlot: 3, catchFielderSlot: 3, coverOfBase: [NONE, NONE, 5, NONE] },
      { runners: [일루주자, 이루주자] },
    )
    expect(autoThrowTargetBase(문)).toBe(3)
  })

  it('송구 시간은 공 가진 야수가 루까지 던지는 틱이다 — 커버 야수 자리가 아니다 (b200c 공가진야수.vtB8)', () => {
    // 중견수(8)가 쥐었다. 3루 앞까지 온 주자는 3루수(4) 자리에서 재면 잡히지만 중견수 송구로는 늦다
    const 삼루앞 = { x: 16_000, y: 0, z: 22_500 }
    const 이루주자 = createRunner(2, 2, runnerSpeedOf(500), { targetBase: 3, position: 삼루앞 })
    const 일루주자 = createRunner(1, 1, runnerSpeedOf(0), { targetBase: 2 })
    const 문 = 문맥(
      { ballHolderSlot: 8, catchFielderSlot: 8, coverOfBase: [1, 2, 3, 4] },
      { runners: [일루주자, 이루주자] },
    )
    expect(autoThrowTargetBase(문)).toBe(2)
  })

  it('아무도 못 잡으면 목표가 없다 (−1)', () => {
    const 문 = 문맥({ ballHolderSlot: 3, catchFielderSlot: 3 }, { runners: [] })
    expect(autoThrowTargetBase(문)).toBe(NONE)
  })
})

describe('2루 커버 규칙 0xb1e24', () => {
  it('1루 쪽 타구면 유격수, 아니면 2루수. 잡은 야수가 그 쪽이면 다른 쪽이 커버한다', () => {
    expect(secondBaseCoverSlot(true, 4)).toBe(5)
    expect(secondBaseCoverSlot(true, 5)).toBe(3)
    expect(secondBaseCoverSlot(false, 4)).toBe(3)
    expect(secondBaseCoverSlot(false, 3)).toBe(5)
  })
})

describe('0xb1c90 의 커버 배치 갈래 0xb203a — 2루 커버가 아닌 키스톤 야수 자리 (송구 없음)', () => {
  // 1루 주자가 2루로 뛰는 중 — 자동 고리가 고르는 루는 2
  const 주자 = [{ ...createRunner(1, 1, runnerSpeedOf(500)), targetBase: 2 }]
  const 배치 = (holderSlot: number, fielders: readonly FielderState[], extra: { relayFlag?: boolean; catchFielderSlot?: number } = {}) =>
    secondBaseHelperPlacement({
      context: 문맥(
        { ballHolderSlot: holderSlot, catchFielderSlot: extra.catchFielderSlot ?? holderSlot },
        { fielders, runners: 주자 },
      ),
      secondBaseCover: 3,
      ballToFirstSide: false,
      relayFlag: extra.relayFlag ?? true,
    })

  it('내야수가 공을 가졌으면 남은 키스톤 야수(유격수)는 표 0xd8764 자리 (14500, 17600) 로 간다', () => {
    expect(배치(4, 야수들)).toEqual({ kind: '자리', slot: 5, target: { x: 14_500, y: 0, z: 17_600 }, relayPlaced: false })
  })

  it('먼 외야수가 아직 안 잡았으면 공가진야수 목표점과 루의 가운데 근처 — 중계 자리, +0x126 을 지운다', () => {
    const 깊은중견 = 야수들.map((fielder) =>
      fielder.slot === 8 ? { ...fielder, target: { x: 20_000, y: 0, z: 0 } } : fielder,
    )
    const 답 = 배치(8, 깊은중견)
    expect(답.kind).toBe('자리')
    if (답.kind !== '자리') return
    expect(답.slot).toBe(5)
    expect(답.relayPlaced).toBe(true)
    // (20000, 0) ~ 2루 (20000, 19170) 의 가운데 (20000, 9585) — 가장 가까운 루(2루)에서 반경(1·2루 거리 / 2)보다 멀다
    expect(답.target).toEqual({ x: 20_000, y: 0, z: 9_585 })
  })

  it('외야수가 이미 쥐었으면 +0x126 이 지워진 뒤엔 그 자리에 멈추고, 아니면 기본 자리다 (b2318)', () => {
    const 쥔중견 = 야수들.map((fielder) =>
      fielder.slot === 8 ? { ...fielder, target: { x: 20_000, y: 0, z: 0 }, holdingBall: true } : fielder,
    )
    expect(배치(8, 쥔중견, { relayFlag: false })).toMatchObject({ target: 쥔중견[5].position })
    expect(배치(8, 쥔중견, { relayFlag: true })).toMatchObject({ target: { x: 14_500, y: 0, z: 17_600 } })
  })

  it('그 야수가 공을 잡을 야수(+0x170)면 건드리지 않는다 (b1f1c)', () => {
    expect(배치(4, 야수들, { catchFielderSlot: 5 })).toEqual({ kind: '그대로' })
  })
})
