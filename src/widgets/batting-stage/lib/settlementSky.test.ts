import { describe, expect, it } from 'vitest'
import { SETTLEMENT_LOSS_SKY_COLUMN, settlementSkyInningOf } from '@/widgets/batting-stage/lib/settlementSky'
import { skyColorsOf } from '@/widgets/batting-stage/lib/stageScenery'

describe('정산 결과 배경의 하늘 칸 (0x4ea0c 4f4fe · 0x76fc4)', () => {
  it('이기면 경기 끝 이닝 칸 그대로 — 0x4ea0c 는 +0x14 를 안 바꾼다', () => {
    expect(settlementSkyInningOf({ isWin: true, inning: 9 })).toBe(9)
  })

  it('지면(비김 포함) 구장객체 +0x18 = 12 → 0x76fc5 — 칸 12, 줄 0 은 색 8 · 줄 1~6 은 9(밤)', () => {
    expect(settlementSkyInningOf({ isWin: false, inning: 3 })).toBe(SETTLEMENT_LOSS_SKY_COLUMN)
    expect(skyColorsOf(0, settlementSkyInningOf({ isWin: false, inning: 3 })).colorIndex).toBe(8)
    for (let row = 1; row <= 6; row += 1) {
      expect(skyColorsOf(row, settlementSkyInningOf({ isWin: false, inning: 3 })).colorIndex).toBe(9)
    }
  })
})
