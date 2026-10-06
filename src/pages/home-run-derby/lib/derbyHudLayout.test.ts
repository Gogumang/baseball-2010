import { describe, expect, it } from 'vitest'
import { comboDisplayPlacementOf } from '@/pages/home-run-derby/lib/derbyHudLayout'

describe('콤보 표시 배치 (0x4585c)', () => {
  it('좌타는 trainning 애니 1(칸 3·4·5·6)을 (0, H/2) 에 그리고, 끝 칸 전에는 숫자가 없다', () => {
    expect(comboDisplayPlacementOf(2, 1, 0)).toEqual({ frame: 3, left: -38, top: 160, digits: [] })
    expect(comboDisplayPlacementOf(2, 1, 1).frame).toBe(4)
    expect(comboDisplayPlacementOf(2, 1, 2)).toMatchObject({ frame: 5, digits: [] })
  })

  it('차례 3 부터 끝 칸 "Combo" 에 머물고 숫자(num 70 + 자리)를 (20, H/2 − 30) 에 붙인다', () => {
    const placed = comboDisplayPlacementOf(3, 1, 3)
    expect(placed).toMatchObject({ frame: 6, left: 0, top: 160 })
    expect(placed.digits).toEqual([{ frame: 73, left: 20, top: 130 }])
    expect(comboDisplayPlacementOf(3, 1, 20).frame).toBe(6)
  })

  it('우타는 애니 2(칸 7·8·9·10)를 (W, H/2) 에, 숫자는 W − 40 부터 그린다', () => {
    expect(comboDisplayPlacementOf(2, 0, 0)).toEqual({ frame: 7, left: 150, top: 160, digits: [] })
    const placed = comboDisplayPlacementOf(12, 0, 5)
    expect(placed).toMatchObject({ frame: 10, left: 177, top: 160 })
    // 1(22×35) 다음 2(29×35) — 전진 = 그림 폭, 높이가 같아 둘 다 y 130
    expect(placed.digits).toEqual([
      { frame: 71, left: 200, top: 130 },
      { frame: 72, left: 222, top: 130 },
    ])
  })

  it('높이가 다른 글자는 가장 큰 글자에 맞춰 아래를 가지런히 한다 (0xba628)', () => {
    // 7(31×34) · 0(32×36)
    expect(comboDisplayPlacementOf(70, 1, 3).digits).toEqual([
      { frame: 77, left: 20, top: 132 },
      { frame: 70, left: 51, top: 130 },
    ])
  })
})
