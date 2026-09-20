import { describe, expect, it } from 'vitest'
import {
  actionStartTickOf,
  backupPointOf,
  catchKindsAt,
  catchRadiusOf,
  CATCH_KIND,
  chooseChaser,
  EMPTY_CATCH_TABLE,
  isDiveCandidate,
  type CatchTable,
  type CatchWindowInput,
} from '@/entities/fielding/model/catchPrediction'

const 야수자리 = { x: 20_000, y: 0, z: 20_000 }
const 창 = (overrides: Partial<CatchWindowInput> = {}): CatchWindowInput => ({
  slot: 3,
  fielder: 야수자리,
  ball: { x: 20_000, y: 800, z: 20_000 },
  tick: 20,
  landingTick: 30,
  ...overrides,
})

describe('포구 반경 — 내야 500 · 외야 300 (0xb1644)', () => {
  it('칸 ≤ 5 는 500, 6~8 은 300', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(catchRadiusOf)).toEqual([
      500, 500, 500, 500, 500, 500, 300, 300, 300,
    ])
  })

  it('내야수는 500 까지 닿고 501 은 못 닿는다', () => {
    expect(catchKindsAt(창({ ball: { x: 20_500, y: 800, z: 20_000 } }))).toContain(CATCH_KIND.LOW)
    expect(catchKindsAt(창({ ball: { x: 20_501, y: 800, z: 20_000 } }))).not.toContain(CATCH_KIND.LOW)
  })

  it('외야수는 300 까지다', () => {
    expect(catchKindsAt(창({ slot: 8, ball: { x: 20_300, y: 800, z: 20_000 } }))).toContain(CATCH_KIND.LOW)
    expect(catchKindsAt(창({ slot: 8, ball: { x: 20_301, y: 800, z: 20_000 } }))).not.toContain(
      CATCH_KIND.LOW,
    )
  })
})

describe('높이 창 (0xb14e2~0xb1584)', () => {
  it('h ≤ 1000 낮은 공 · 1001~1700 가슴 높이', () => {
    expect(catchKindsAt(창({ ball: { x: 20_000, y: 1000, z: 20_000 } }))).toEqual([CATCH_KIND.LOW])
    expect(catchKindsAt(창({ ball: { x: 20_000, y: 1001, z: 20_000 } }))).toEqual([CATCH_KIND.CHEST])
    expect(catchKindsAt(창({ ball: { x: 20_000, y: 1700, z: 20_000 } }))).toEqual([CATCH_KIND.CHEST])
    expect(catchKindsAt(창({ ball: { x: 20_000, y: 1701, z: 20_000 } }))).toEqual([])
  })

  it('h ≤ 500 은 낙구 전이면 반경 1000 의 땅볼 포구도 함께 잡힌다', () => {
    const kinds = catchKindsAt(창({ ball: { x: 20_900, y: 400, z: 20_000 } }))
    expect(kinds).toEqual([CATCH_KIND.GROUNDER])
  })

  it('낙구 뒤에는 땅볼 창이 닫힌다', () => {
    expect(catchKindsAt(창({ ball: { x: 20_900, y: 400, z: 20_000 }, tick: 31 }))).toEqual([])
  })

  it('필살 점프는 1701~4000 을 ±299 상자 안에서, 8틱 뒤·낙구 전에만', () => {
    const 공 = { x: 20_299, y: 2000, z: 20_000 }
    expect(catchKindsAt(창({ ball: 공, jumpUnlocked: true }))).toEqual([CATCH_KIND.JUMP])
    expect(catchKindsAt(창({ ball: { ...공, x: 20_300 }, jumpUnlocked: true }))).toEqual([])
    expect(catchKindsAt(창({ ball: 공, jumpUnlocked: true, tick: 7 }))).toEqual([])
    expect(catchKindsAt(창({ ball: 공 }))).toEqual([]) // 창이 안 열렸다
  })

  it('필살 슬라이딩은 501~1500 을 거리 2000~3000 에서, 낙구 2틱 전 이내·6틱 뒤에만', () => {
    const 앞쪽공 = { x: 20_000, y: 1200, z: 22_500 } // 야수보다 홈 쪽(z 가 큼)
    expect(catchKindsAt(창({ ball: 앞쪽공, slideUnlocked: true, tick: 29 }))).toEqual([CATCH_KIND.SLIDE])
    // 야수 뒤쪽 공은 안 된다
    expect(
      catchKindsAt(창({ ball: { x: 20_000, y: 1200, z: 17_500 }, slideUnlocked: true, tick: 29 })),
    ).toEqual([])
    // 낙구까지 3틱 이상 남으면 안 된다
    expect(catchKindsAt(창({ ball: 앞쪽공, slideUnlocked: true, tick: 27 }))).toEqual([])
  })

  it('지정 야수 모드면 다른 야수의 낮은 공·가슴 창이 닫힌다 (플레이+0x1e8)', () => {
    expect(catchKindsAt(창({ onlySlot: 3 }))).toEqual([CATCH_KIND.LOW])
    expect(catchKindsAt(창({ onlySlot: 4 }))).toEqual([])
  })
})

describe('다이빙 후보 (표 +0x178)', () => {
  it('타구가 타석에서 시작한 낮은 공이고 거리가 1000 초과 2000 이하일 때만', () => {
    const 기본 = { ...창({ ball: { x: 21_500, y: 400, z: 20_000 } }), startedAtPlate: true }
    expect(isDiveCandidate(기본)).toBe(true)
    expect(isDiveCandidate({ ...기본, startedAtPlate: false })).toBe(false)
    expect(isDiveCandidate({ ...기본, ball: { x: 21_000, y: 400, z: 20_000 } })).toBe(false)
    expect(isDiveCandidate({ ...기본, ball: { x: 22_001, y: 400, z: 20_000 } })).toBe(false)
  })
})

describe('추적야수 고르기 0xb3b38 — 우선순위', () => {
  const 표 = (overrides: Partial<CatchTable>): CatchTable => ({ ...EMPTY_CATCH_TABLE, ...overrides })

  it('낙구 전에 낮은 공을 잡을 수 있으면 "가장 가까운 야수" 가 간다 (우선순위 1)', () => {
    const 고름 = chooseChaser(표({ low: { tick: 12, slot: 7 }, chest: { tick: 11, slot: 4 } }), 30, 6)
    expect(고름).toEqual({ kind: CATCH_KIND.LOW, slot: 6, catchTick: 12, actionStartTick: 12 })
  })

  it('가슴 높이는 두 번째, 동작은 2틱 먼저 시작한다', () => {
    const 고름 = chooseChaser(표({ chest: { tick: 14, slot: 4 }, grounder: { tick: 9, slot: 5 } }), 30, 6)
    expect(고름).toEqual({ kind: CATCH_KIND.CHEST, slot: 4, catchTick: 14, actionStartTick: 12 })
  })

  it('땅볼이 세 번째, 필살(점프·슬라이딩)은 그 뒤다 — 보통 포구가 되면 필살은 안 쓰인다', () => {
    expect(chooseChaser(표({ grounder: { tick: 9, slot: 5 }, jump: { tick: 5, slot: 8 } }), 30, 6).kind).toBe(
      CATCH_KIND.GROUNDER,
    )
    expect(chooseChaser(표({ jump: { tick: 5, slot: 8 } }), 30, 6)).toEqual({
      kind: CATCH_KIND.JUMP,
      slot: 8,
      catchTick: 5,
      actionStartTick: -3,
    })
  })

  it('낙구 뒤(바운드 뒤)는 lo < mid + 2 · mid + 2 < gd + 5 순으로 갈린다', () => {
    expect(chooseChaser(표({ low: { tick: 40, slot: 6 }, chest: { tick: 39, slot: 4 } }), 30, 2).slot).toBe(6)
    expect(chooseChaser(표({ low: { tick: 45, slot: 6 }, chest: { tick: 39, slot: 4 } }), 30, 2)).toEqual({
      kind: CATCH_KIND.CHEST,
      slot: 4,
      catchTick: 39,
      actionStartTick: 37,
    })
  })

  it('아무도 못 잡으면 가장 가까운 야수가 낮은 공으로 간다', () => {
    expect(chooseChaser(EMPTY_CATCH_TABLE, 30, 8).slot).toBe(8)
    expect(chooseChaser(EMPTY_CATCH_TABLE, 30, 8).kind).toBe(CATCH_KIND.LOW)
  })

  it('동작 시작 틱 분기표 0xd87c0', () => {
    expect([
      actionStartTickOf(CATCH_KIND.LOW, 20),
      actionStartTickOf(CATCH_KIND.CHEST, 20),
      actionStartTickOf(CATCH_KIND.GROUNDER, 20),
      actionStartTickOf(CATCH_KIND.JUMP, 20),
      actionStartTickOf(CATCH_KIND.SLIDE, 20),
    ]).toEqual([20, 18, 19, 12, 14])
  })
})

describe('외야 백업 (AI 상태 0xc, 0xb4b78) — 원본 버그 그대로', () => {
  it('x 또는 z 가 +2000 을 넘게 앞설 때만 걸린다', () => {
    const 목표 = { x: 30_000, y: 0, z: 10_000 }
    expect(backupPointOf(목표, { x: 20_000, y: 0, z: 10_000 })).toEqual({ x: 28_000, y: 0, z: 10_000 })
  })

  it('음수 쪽으로 2000 넘게 벌어진 경우는 무시한다 (0xb4bae 가 > 만 본다)', () => {
    const 목표 = { x: 10_000, y: 0, z: 10_000 }
    expect(backupPointOf(목표, { x: 30_000, y: 0, z: 10_000 })).toBeNull()
  })
})
