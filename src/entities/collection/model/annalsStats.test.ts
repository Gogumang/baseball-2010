import { describe, expect, it } from 'vitest'
import {
  addGamePointUsage, applyAnnalsStat, countItemPurchase, EMPTY_ANNALS_STATS, GAME_POINT_USAGE_LIMIT,
  gamePointUsageOf, itemPurchaseCountOf, markSkillEquipped, normalizeAnnalsStats,
} from '@/entities/collection/model/annalsStats'

/** 기록연감 통계 기록 `[mgr+0xc8]` — 0x22e35 · 0x22c29 · 0xb663c (디스어셈 확정) */
describe('GP 아이템 구매 수 0x22e35', () => {
  it('모드 4 → 칸 0 · 3 → 1 · 2 → 2, 칸마다 1 씩 센다', () => {
    let stats = countItemPurchase(EMPTY_ANNALS_STATS, 4, 9)
    stats = countItemPurchase(stats, 3, 0)
    stats = countItemPurchase(stats, 2, 3)
    stats = countItemPurchase(stats, 2, 3)

    expect(itemPurchaseCountOf(stats, 4, 9)).toBe(1)
    expect(itemPurchaseCountOf(stats, 3, 0)).toBe(1)
    expect(itemPurchaseCountOf(stats, 2, 3)).toBe(2)
    expect(stats.itemPurchaseCounts[2 * 10 + 3]).toBe(2)
  })

  it('칸 > 9 이거나 모드가 2·3·4 가 아니면 그대로다', () => {
    expect(countItemPurchase(EMPTY_ANNALS_STATS, 4, 10)).toBe(EMPTY_ANNALS_STATS)
    expect(countItemPurchase(EMPTY_ANNALS_STATS, 1, 0)).toBe(EMPTY_ANNALS_STATS)
  })

  it('u16 이라 65535 다음은 0 이다', () => {
    const full = { ...EMPTY_ANNALS_STATS, itemPurchaseCounts: EMPTY_ANNALS_STATS.itemPurchaseCounts.map(() => 0xffff) }
    expect(itemPurchaseCountOf(countItemPurchase(full, 4, 0), 4, 0)).toBe(0)
  })
})

describe('G 사용처 0x22c29', () => {
  it('사용처 k 칸에 더하고 0~99999999 로 자른다', () => {
    const stats = addGamePointUsage(addGamePointUsage(EMPTY_ANNALS_STATS, 1, 5000), 1, 10000)
    expect(gamePointUsageOf(stats, 1)).toBe(15000)
    expect(gamePointUsageOf(addGamePointUsage(stats, 1, GAME_POINT_USAGE_LIMIT), 1)).toBe(GAME_POINT_USAGE_LIMIT)
    expect(gamePointUsageOf(addGamePointUsage(stats, 1, -99999), 1)).toBe(0)
  })

  it('k > 7 은 무시하고, 읽기 0x2322d 는 −1 을 돌려준다', () => {
    expect(addGamePointUsage(EMPTY_ANNALS_STATS, 8, 100)).toBe(EMPTY_ANNALS_STATS)
    expect(gamePointUsageOf(EMPTY_ANNALS_STATS, 8)).toBe(-1)
  })

  it('나리 상점 GP 아이템은 구매 수와 사용처(모드 4 → 1 · 3 → 2)를 함께 쌓는다 (0x14ffe · 0x1501e)', () => {
    const batter = applyAnnalsStat(EMPTY_ANNALS_STATS, { kind: 'GP아이템구매', mode: 4, index: 2, price: 500 })
    const pitcher = applyAnnalsStat(batter, { kind: 'GP아이템구매', mode: 3, index: 9, price: 500 })

    expect(itemPurchaseCountOf(pitcher, 4, 2)).toBe(1)
    expect(itemPurchaseCountOf(pitcher, 3, 9)).toBe(1)
    expect(pitcher.gamePointUsage.slice(0, 3)).toEqual([0, 500, 500])
  })
})

describe('켠 스킬 비트 0xb663c (+0xf4 · +0xf8)', () => {
  it('모드 4 는 +0xf4, 3 은 +0xf8 에 OR 하고 그 밖 모드는 안 쓴다', () => {
    let stats = markSkillEquipped(EMPTY_ANNALS_STATS, 4, 3)
    stats = markSkillEquipped(stats, 4, 23)
    stats = markSkillEquipped(stats, 3, 8)

    expect(stats.batterEquippedSkillBits).toBe((1 << 3) | (1 << 23))
    expect(stats.pitcherEquippedSkillBits).toBe(1 << 8)
    expect(markSkillEquipped(stats, 2, 1)).toBe(stats)
  })
})

describe('저장에서 읽기', () => {
  it('깨진 칸만 0 으로 되돌린다', () => {
    const stats = normalizeAnnalsStats({ itemPurchaseCounts: [1], gamePointUsage: [1, 2, 3, 4, 5, 6, 7, 8], batterEquippedSkillBits: 'x' })
    expect(stats.itemPurchaseCounts).toEqual(EMPTY_ANNALS_STATS.itemPurchaseCounts)
    expect(stats.gamePointUsage).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(stats.batterEquippedSkillBits).toBe(0)
    expect(normalizeAnnalsStats(undefined)).toEqual(EMPTY_ANNALS_STATS)
  })
})
