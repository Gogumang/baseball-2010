import { describe, expect, it } from 'vitest'
import {
  GAME_POINT_LIMIT,
  addGamePoint,
  canAffordGamePoint,
  clampGamePoint,
  migrateWallet,
  spendGamePoint,
} from '@/entities/wallet/model/gamePointWallet'

/** 원본 전역 기록 `mgr[+0x64]` — 마선수 구매 0xa3d6~0xa3f4 가 규칙을 다 보여 준다 */

describe('G 자르기 (0xa3e4~0xa3f0)', () => {
  it('상한은 99999 다', () => {
    expect(GAME_POINT_LIMIT).toBe(99999)
    expect(clampGamePoint(100000)).toBe(99999)
    expect(addGamePoint({ gamePoint: 99000 }, 5000)).toEqual({ gamePoint: 99999 })
  })

  it('음수면 0 으로 붙인다', () => {
    expect(clampGamePoint(-1)).toBe(0)
    expect(addGamePoint({ gamePoint: 300 }, -1000)).toEqual({ gamePoint: 0 })
  })
})

describe('값 치르기 (0xa3dc `blt`)', () => {
  it('가격과 딱 같으면 산다', () => {
    expect(canAffordGamePoint({ gamePoint: 1000 }, 1000)).toBe(true)
    expect(spendGamePoint({ gamePoint: 1000 }, 1000)).toEqual({ gamePoint: 0 })
  })

  it('한 푼이라도 모자라면 **한 푼도 안 깎인다** (0xa46e 갈래)', () => {
    expect(canAffordGamePoint({ gamePoint: 999 }, 1000)).toBe(false)
    expect(spendGamePoint({ gamePoint: 999 }, 1000)).toEqual({ gamePoint: 999 })
  })
})

describe('옛 세이브 이사', () => {
  it('지갑 칸이 없으면 옛 `career.gamePoint` 를 그대로 옮겨 온다', () => {
    expect(migrateWallet(null, 4500)).toEqual({ gamePoint: 4500 })
  })

  it('지갑 칸이 있으면 옛 값을 보지 않는다 — 이사는 한 번뿐이다', () => {
    expect(migrateWallet({ gamePoint: 700 }, 4500)).toEqual({ gamePoint: 700 })
  })

  it('지갑에 0 이 들어 있어도 이사를 다시 하지 않는다 (다 써 버린 지갑)', () => {
    expect(migrateWallet({ gamePoint: 0 }, 4500)).toEqual({ gamePoint: 0 })
  })

  it('옛 세이브도 없으면 0 에서 시작한다', () => {
    expect(migrateWallet(null, null)).toEqual({ gamePoint: 0 })
    expect(migrateWallet(undefined)).toEqual({ gamePoint: 0 })
  })

  it('형식이 깨진 저장은 버리고 옛 값으로 간다', () => {
    expect(migrateWallet({ gamePoint: '많이' }, 1200)).toEqual({ gamePoint: 1200 })
    expect(migrateWallet('망가짐', 1200)).toEqual({ gamePoint: 1200 })
  })

  it('옛 값이 상한을 넘어도 99999 로 자른다', () => {
    expect(migrateWallet(null, 123456)).toEqual({ gamePoint: 99999 })
  })
})
