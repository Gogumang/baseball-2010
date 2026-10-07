import { describe, expect, it } from 'vitest'
import {
  CENTER_STAGE, coachPortraitIndexOf, leadExpressionOf, nariStageCharactersOf, seasonStageCharactersOf, stageSlideOffsetAt,
} from '@/pages/management/lib/centerStage'

describe('가운데 판 0x7f814 — 경기장 띠 위 인물', () => {
  it('발 y 135 · 136 줄 아래는 잘린다 (프레임 10 박스 0 = 0,65,240,72)', () => {
    expect([CENTER_STAGE.footY, CENTER_STAGE.clipHeight]).toEqual([135, 136])
  })

  it('표정 0x85f38 — 사기 > 90 → 1 · ≤ 50 → 6 · 그 밖 0 · 질병(나리는 부상도) 6', () => {
    expect([91, 90, 51, 50, 0].map((morale) => leadExpressionOf(morale, false))).toEqual([1, 0, 0, 6, 6])
    expect(leadExpressionOf(100, true)).toBe(6)
  })

  it('시즌 코치 0x86020 — SR+0x185 < 0 없음 · 점프표 0xd4aa4 · 9 넘으면 0x11', () => {
    expect([-1, 0, 1, 4, 5, 9, 10].map(coachPortraitIndexOf)).toEqual([null, 0x11, 0xb, 0x13, 0xa, 0x16, 0x11])
  })

  it('시즌: 코치가 있으면 코치(85) → 감독(155), 없으면 감독 하나(145) — 감독은 event_char_0 애니 16 + 표정', () => {
    expect(seasonStageCharactersOf({ teamMorale: 95, illness: 0, coach: -1 })).toEqual([
      { file: 'event_char_0', animation: 17, palette: null, x: 145 },
    ])
    // 칸 1 → idx 0xb → event_char_1 애니 0xd0ae6[11] = 7 · 칸 0 → idx 0x11 → event_char_2 애니 40
    expect(seasonStageCharactersOf({ teamMorale: 70, illness: 2, coach: 1 })).toEqual([
      { file: 'event_char_1', animation: 7, palette: null, x: 85 },
      { file: 'event_char_0', animation: 22, palette: null, x: 155 },
    ])
    expect(seasonStageCharactersOf({ teamMorale: 70, illness: 0, coach: 0 })[0]).toEqual(
      { file: 'event_char_2', animation: 40, palette: null, x: 85 },
    )
  })

  it('나리: 선수 하나(idx 1) — 장타형 +8 · 피부 팔레트(1 → 0 · 2 → 1 · 0 → 없음)', () => {
    expect(nariStageCharactersOf({ morale: 60, isSick: false, isInjured: true, isSlugger: true, skinIndex: 2 })).toEqual([
      { file: 'event_char_0', animation: 14, palette: 1, x: 145 },
    ])
    expect(nariStageCharactersOf({ morale: 60, isSick: false, isInjured: false, isSlugger: false, skinIndex: 0 })[0].palette).toBeNull()
  })

  it('미끄러짐 — 120 에서 그린 뒤마다 [gfx+0x348]/8 씩 줄어 0 에 선다', () => {
    const solo = seasonStageCharactersOf({ teamMorale: 70, illness: 0, coach: -1 })
    expect(Array.from({ length: 8 }, (_unused, t) => stageSlideOffsetAt(solo, t, true))).toEqual([120, 102, 84, 66, 48, 30, 12, 0])
    const paired = seasonStageCharactersOf({ teamMorale: 70, illness: 0, coach: 3 })
    expect(Array.from({ length: 8 }, (_unused, t) => stageSlideOffsetAt(paired, t, true))).toEqual([120, 101, 82, 63, 44, 25, 6, 0])
    expect(stageSlideOffsetAt(paired, 0, false)).toBe(0)
  })
})
