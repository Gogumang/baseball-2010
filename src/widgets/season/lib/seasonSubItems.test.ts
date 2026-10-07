import { describe, expect, it } from 'vitest'
import { ownsSeasonSubItem, seasonSubItemsOf } from '@/widgets/season/lib/seasonSubItems'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'

const 레코드 = startNewSeason(0, '단장').record

describe('시즌 서브아이템 10칸 (0x81dc0 시즌 갈래)', () => {
  it('이름 StrITEM[0x6d + k] · 아이콘 0xd464e · 값 0xd45f4 × 1000 만원', () => {
    const items = seasonSubItemsOf(레코드)
    expect(items.map((item) => item.name)).toEqual([
      '표적판', '피칭머신', 'MG스퀘어', '하드타이어', '자동안마기', '서포터스', '출장부페', '보험증서', '야구교본', '마스코트',
    ])
    expect(items.map((item) => item.iconFrame)).toEqual([0, 26, 25, 3, 4, 24, 6, 7, 8, 23])
    expect(items[0].price).toBe(25000)
    expect(items[9].price).toBe(30000)
  })

  it('설명 = StrITEM[0xe1 + k] + "효과 : " + (k ≤ 3 이면 "%s 훈련 시 +2" 에 투구·타격·집중·근성)', () => {
    const items = seasonSubItemsOf(레코드)
    expect(items[1].description).toContain('!N효과 : !cFFFF00타격 훈련 시 +2')
    expect(items[4].description).toContain('훈련 시 사기 감소량 -1')
    expect(items[9].description).toContain('방송국 [구단CF]')
  })

  it('보유 = SR+0x58 + k — 트레이닝 4 · 자동안마기 · 외출 5', () => {
    const record = { ...레코드, trainingSubItems: [false, true, false, false], massager: true, outingSubItems: [false, false, false, false, true] }
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((slot) => ownsSeasonSubItem(record, slot))).toEqual([1, 4, 9])
  })
})
