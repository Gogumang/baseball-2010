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
  it('아직 안 잡은 내야 송구: 남은 6 + (송구 6 + 준비 3) = 15', () => {
    const 문 = 문맥(
      { ballHolderSlot: 3, catchFielderSlot: 3, coverOfBase: [NONE, 2, NONE, NONE], catchTick: 10 },
      { currentTick: 4 },
    )
    expect(defenseArrivalTicks(문, 1)).toBe(15)
  })

  it('이미 잡았으면 준비 틱 대신 진행 중인 동작의 남은 틱(+0xc8)이 붙는다', () => {
    const 야수: readonly FielderState[] = 야수들.map((fielder, slot) =>
      slot === 3 ? { ...fielder, holdingBall: true, actionRemainingTicks: 2 } : fielder,
    )
    const 문 = 문맥(
      { ballHolderSlot: 3, catchFielderSlot: 3, coverOfBase: [NONE, 2, NONE, NONE], catchTick: 10 },
      { fielders: 야수, currentTick: 4 },
    )
    expect(defenseArrivalTicks(문, 1)).toBe(8) // 송구 6 + 동작 2
  })

  it('외야에서 17000 이상이면 중계가 끼고 준비 틱도 6 이 된다 — 중계 32 + 준비 6 = 38', () => {
    const 문 = 문맥({
      ballHolderSlot: 8,
      catchFielderSlot: 8,
      coverOfBase: [1, NONE, NONE, NONE],
      catchTick: 0,
    })
    expect(defenseArrivalTicks(문, 0)).toBe(38)
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
