import { describe, expect, it } from 'vitest'
import { ABILITY_RADAR_LABELS, abilityRadarAxesOf } from '@/pages/create-player/lib/abilityRadarPanel'

describe('ABILITY 판 축 칸 (0x5aefc 0x5b412~0x5b532)', () => {
  it('반지름 30 — 끝은 가운데 ± 48 × cos45 (내림), 상자는 끝에서 바깥쪽으로 26×29 를 편다', () => {
    const axes = abilityRadarAxesOf({ x: 178, y: 104 }, 30)
    // 각도 225 · 315 · 45 · 135 — (48 × ∓46340) >> 16 = −34 · 33
    expect(axes.map((axis) => axis.end)).toEqual([
      { x: 144, y: 70 }, { x: 211, y: 70 }, { x: 211, y: 137 }, { x: 144, y: 137 },
    ])
    // 왼쪽은 끝x − 26 + 2, 오른쪽은 끝x − 1 / 위는 끝y − 1, 아래는 끝y − 29 + 2. 반지름 30 이라 보정 d = 0
    expect(axes.map((axis) => axis.box)).toEqual([
      { x: 120, y: 69 }, { x: 210, y: 69 }, { x: 210, y: 110 }, { x: 120, y: 110 },
    ])
  })

  it('반지름이 30 이 아니면 x 는 안쪽으로, y 는 (각도 > 180 이면 위로 · 아니면 아래로) |30 − R| 만큼 옮긴다', () => {
    const axes = abilityRadarAxesOf({ x: 0, y: 0 }, 22)
    // 끝 = (40 × ∓46340) >> 16 = −29 · 28
    expect(axes.map((axis) => axis.end)).toEqual([{ x: -29, y: -29 }, { x: 28, y: -29 }, { x: 28, y: 28 }, { x: -29, y: 28 }])
    expect(axes.map((axis) => axis.box)).toEqual([
      { x: -29 - 26 + 2 + 8, y: -29 - 1 - 8 },
      { x: 28 - 1 - 8, y: -29 - 1 - 8 },
      { x: 28 - 1 - 8, y: 28 - 29 + 2 + 8 },
      { x: -29 - 26 + 2 + 8, y: 28 - 29 + 2 + 8 },
    ])
  })

  it('축 이름 표 0xd1b14 — 투수 37~40 · 타자 41~44', () => {
    expect(ABILITY_RADAR_LABELS.pitcher).toEqual([37, 38, 39, 40])
    expect(ABILITY_RADAR_LABELS.batter).toEqual([41, 42, 43, 44])
  })
})
