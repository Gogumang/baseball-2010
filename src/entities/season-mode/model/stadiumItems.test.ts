import { describe, expect, it } from 'vitest'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import {
  BOARD_BONUS_TABLE,
  STADIUM_PRICE_TABLE,
  STADIUM_REQUIRED_POPULARITY,
  STAND_CAPACITY_TABLE,
  boardBonusOf,
  buyStadiumItem,
  checkStadiumPurchase,
  equipStadiumItem,
  isStadiumCollector,
  ownsStadiumItem,
  requiredPopularityOf,
  stadiumCollectorUnlocks,
  seasonStadiumOf,
  stadiumPriceOf,
  standCapacityOf,
} from '@/entities/season-mode/model/stadiumItems'

const 기본 = (덮어쓰기: Partial<SeasonRecord> = {}): SeasonRecord => ({
  ...startNewSeason(0, '테스트구단').record,
  ...덮어쓰기,
})

const 언제나열림 = () => true
const 언제나잠김 = () => false

describe('구장 아이템 가격표 — 진짜 표는 0xcbc64 다 (S3 3절)', () => {
  it('관중석은 3·6·10·20억이다 (표값 ×100 = 100만 단위)', () => {
    expect(STADIUM_PRICE_TABLE[0]).toEqual([0, 3, 6, 10, 20, 20, 20])
    expect(stadiumPriceOf('관중석', 0)).toBe(0)
    expect(stadiumPriceOf('관중석', 1)).toBe(300)
    expect(stadiumPriceOf('관중석', 2)).toBe(600)
    expect(stadiumPriceOf('관중석', 3)).toBe(1_000)
    expect(stadiumPriceOf('관중석', 4)).toBe(2_000)
  })

  it('전광판은 2·4·7·15억이다', () => {
    expect(STADIUM_PRICE_TABLE[1]).toEqual([0, 2, 4, 7, 15, 15, 15])
    expect(stadiumPriceOf('전광판', 1)).toBe(200)
    expect(stadiumPriceOf('전광판', 2)).toBe(400)
    expect(stadiumPriceOf('전광판', 3)).toBe(700)
    expect(stadiumPriceOf('전광판', 4)).toBe(1_500)
  })

  it('잔디도 표에 값이 있다 — 1·2·3억 (J 4-9 는 "행이 없다" 고 적었지만 있다)', () => {
    expect(STADIUM_PRICE_TABLE[2]).toEqual([0, 1, 2, 3])
    expect(stadiumPriceOf('잔디', 1)).toBe(100)
    expect(stadiumPriceOf('잔디', 2)).toBe(200)
    expect(stadiumPriceOf('잔디', 3)).toBe(300)
    expect(stadiumPriceOf('잔디', 4)).toBeNull()
  })

  it('필요 인기도(0xcbc34)는 가격과 다른 표다 — 0xd44c4 를 가격으로 읽으면 안 된다', () => {
    expect(STADIUM_REQUIRED_POPULARITY[0]).toEqual([0, 200, 500, 800, 1000, 1000, 1000])
    expect(STADIUM_REQUIRED_POPULARITY[1]).toEqual([0, 100, 400, 700, 900, 900, 900])
    // 잔디는 인기도 제한이 아예 없다
    expect(STADIUM_REQUIRED_POPULARITY[2]).toEqual([0, 0, 0, 0])
    expect(requiredPopularityOf('관중석', 1)).toBe(200)
    expect(requiredPopularityOf('관중석', 1)).not.toBe(stadiumPriceOf('관중석', 1))
  })
})

describe('구매 가드 순서 — 미오픈 → 보유 → 인기도 → 소지금 (0x9a84)', () => {
  it('히든 칸(4~6)은 해금 플래그가 없으면 미오픈이다', () => {
    const record = 기본({ money: 9_999 })
    expect(checkStadiumPurchase(record, 9_999, '관중석', 4, 언제나잠김)).toEqual({ ok: false, reason: '미오픈' })
    expect(checkStadiumPurchase(record, 9_999, '관중석', 4, 언제나열림).ok).toBe(true)
  })

  it('잔디에는 히든이 없다 — 4칸이 전부라 미오픈 검사를 안 탄다', () => {
    const record = 기본({ money: 9_999 })
    expect(checkStadiumPurchase(record, 0, '잔디', 3, 언제나잠김)).toEqual({ ok: true, price: 300 })
  })

  it('이미 보유한 칸이 인기도·소지금보다 먼저 걸린다', () => {
    const owned = [...기본().stadiumOwned]
    owned[1] = true
    const record = 기본({ stadiumOwned: owned, money: 0 })
    expect(checkStadiumPurchase(record, 0, '관중석', 1, 언제나열림)).toEqual({ ok: false, reason: '이미보유' })
  })

  it('인기도가 소지금보다 먼저 걸린다', () => {
    const record = 기본({ money: 0 })
    expect(checkStadiumPurchase(record, 199, '관중석', 1, 언제나열림)).toEqual({
      ok: false,
      reason: '인기도부족',
      required: 200,
    })
  })

  it('인기도를 넘기면 소지금을 본다', () => {
    const record = 기본({ money: 299 })
    expect(checkStadiumPurchase(record, 200, '관중석', 1, 언제나열림)).toEqual({
      ok: false,
      reason: '소지금부족',
      required: 300,
    })
    expect(checkStadiumPurchase(기본({ money: 300 }), 200, '관중석', 1, 언제나열림)).toEqual({
      ok: true,
      price: 300,
    })
  })
})

describe('구매 확정 0x812c', () => {
  it('소지금만 깎고 — ⚠️ 인기도는 깎지 않는다', () => {
    const record = 기본({ money: 1_000, popularity: 500 })
    const 뒤 = buyStadiumItem(record, '관중석', 1)
    expect(뒤.money).toBe(700)
    // 인기도는 조건일 뿐이라 차감 코드가 없다 (S3 5-1 확정)
    expect(뒤.popularity).toBe(500)
  })

  it('보유 표시를 하고 그 자리에서 바로 장착된다', () => {
    const 뒤 = buyStadiumItem(기본({ money: 9_999 }), '전광판', 3)
    expect(ownsStadiumItem(뒤, '전광판', 3)).toBe(true)
    expect(뒤.stadiumEquipped).toEqual([0, 3, 0])
  })

  it('보유 플래그 자리는 7×종류+칸 이라 종류끼리 겹치지 않는다', () => {
    const 뒤 = buyStadiumItem(buyStadiumItem(기본({ money: 9_999 }), '잔디', 1), '관중석', 1)
    expect(ownsStadiumItem(뒤, '잔디', 1)).toBe(true)
    expect(ownsStadiumItem(뒤, '관중석', 1)).toBe(true)
    expect(ownsStadiumItem(뒤, '전광판', 1)).toBe(false)
  })

  it('소지금은 0 아래로 내려가지 않는다 (9999 클램프의 반대쪽)', () => {
    expect(buyStadiumItem(기본({ money: 10 }), '관중석', 4).money).toBe(0)
  })
})

describe('교체 0x7958 — ⚠️ 가드가 아예 없다', () => {
  it('사지 않은 칸도 그대로 끼워진다 (가격·인기도·보유 검사가 없다)', () => {
    const record = 기본({ money: 0, popularity: 0 })
    const 뒤 = equipStadiumItem(record, '관중석', 6)
    expect(뒤.stadiumEquipped[0]).toBe(6)
    expect(ownsStadiumItem(뒤, '관중석', 6)).toBe(false)
    expect(뒤.money).toBe(0)
  })

  it('종류마다 한 칸씩만 바꾼다', () => {
    const 뒤 = equipStadiumItem(equipStadiumItem(기본(), '전광판', 2), '잔디', 3)
    expect(뒤.stadiumEquipped).toEqual([0, 2, 3])
  })
})

describe('컬렉터 해금 0xa38c4 — 기본 4칸(0~3)을 다 모으면', () => {
  it('4칸을 다 사면 관중석 13 · 전광판 16 이 열린다', () => {
    let record = 기본({ money: 9_999 })
    for (const slot of [0, 1, 2, 3]) record = buyStadiumItem(record, '관중석', slot)
    expect(isStadiumCollector(record, '관중석')).toBe(true)
    expect(stadiumCollectorUnlocks(record)).toEqual([13])
    for (const slot of [0, 1, 2, 3]) record = buyStadiumItem(record, '전광판', slot)
    expect(stadiumCollectorUnlocks(record)).toEqual([13, 16])
  })

  it('히든 칸만으로는 컬렉터가 되지 않는다', () => {
    const record = buyStadiumItem(기본({ money: 9_999 }), '관중석', 5)
    expect(isStadiumCollector(record, '관중석')).toBe(false)
  })
})

describe('효과 — 관중석은 상한만, 전광판은 가산만 (0xa34b8)', () => {
  it('표는 0xd7cc4 그대로다', () => {
    expect(STAND_CAPACITY_TABLE).toEqual([20, 25, 30, 35, 40, 40, 40])
    expect(BOARD_BONUS_TABLE).toEqual([0, 2, 3, 4, 5, 5, 5])
  })

  it('히든 3종은 4번과 효과가 같다 — 성능이 아니라 겉모습이다', () => {
    expect(STAND_CAPACITY_TABLE[4]).toBe(STAND_CAPACITY_TABLE[6])
    expect(BOARD_BONUS_TABLE[4]).toBe(BOARD_BONUS_TABLE[6])
  })

  it('장착한 칸으로 수용 상한과 가산을 읽는다', () => {
    const record = 기본({ stadiumEquipped: [2, 3, 3] })
    expect(standCapacityOf(record)).toBe(30_000)
    expect(boardBonusOf(record)).toBe(4_000)
  })

  it('⚠️ 잔디는 어떤 계산에도 안 들어간다 — 잔디만 바꿔도 값이 그대로다', () => {
    const 잔디0 = 기본({ stadiumEquipped: [2, 3, 0] })
    const 잔디3 = 기본({ stadiumEquipped: [2, 3, 3] })
    expect(standCapacityOf(잔디0)).toBe(standCapacityOf(잔디3))
    expect(boardBonusOf(잔디0)).toBe(boardBonusOf(잔디3))
  })
})

describe('시즌 홈경기 구장 세 칸 — 경기 준비 0x353ac~0x353e6', () => {
  it('관중석은 +0x1b8, 전광판은 +0x1b9 를 그대로 옮긴다 (잔디는 안 간다)', () => {
    const record = 기본({ stadiumEquipped: [2, 5, 3] })
    expect(seasonStadiumOf(record)).toEqual({ stand: 2, crowd: 1, board: 5 })
  })

  it('관중 단계는 만원 판정 SR+0x65 에 1 을 더한 값이다 (0x353cc)', () => {
    expect(seasonStadiumOf(기본({ crowdLevel: 0 })).crowd).toBe(1)
    expect(seasonStadiumOf(기본({ crowdLevel: 1 })).crowd).toBe(2)
    expect(seasonStadiumOf(기본({ crowdLevel: 2 })).crowd).toBe(3)
  })

  it('히든 칸(4~6)도 그대로 넘어간다 — 그리는 쪽이 hidden_* 로 가른다', () => {
    expect(seasonStadiumOf(기본({ stadiumEquipped: [6, 4, 0] }))).toEqual({ stand: 6, crowd: 1, board: 4 })
  })
})
