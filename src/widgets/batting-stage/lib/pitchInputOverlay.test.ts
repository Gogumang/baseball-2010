import { describe, expect, it } from 'vitest'
import {
  gaugeDrawsOf,
  pitchMenuFrameOf,
  pitchMenuLabelX,
  pitchMenuShineStepOf,
  spotlightLevelAt,
} from '@/widgets/batting-stage/lib/pitchInputOverlay'

describe('0xf 구질 목록 (0x4c4bc 4c528~)', () => {
  const types = [1, 2, 0, 5, 7, 22]

  it('진입 0x16 에서 그림마다 고리 +1, 0x19 에 멈추고 그림 3 부터 칸을 그린다', () => {
    expect(pitchMenuFrameOf(0, types)).toEqual({ ring: 0x16, slotFrames: [0x26, null, 0x2e, 0x32], showsSlots: false })
    expect(pitchMenuFrameOf(2, types).ring).toBe(0x18)
    expect(pitchMenuFrameOf(3, types)).toEqual({ ring: 0x19, slotFrames: [0x29, null, 0x31, 0x35], showsSlots: true })
    expect(pitchMenuFrameOf(40, types).ring).toBe(0x19)
  })

  it('반짝임 애니 2 — 틱 4 와 70 의 배수에서 한 번씩', () => {
    expect(pitchMenuShineStepOf(3, 8)).toBeNull()
    expect(pitchMenuShineStepOf(4, 8)).toBe(0)
    expect(pitchMenuShineStepOf(11, 8)).toBe(7)
    expect(pitchMenuShineStepOf(12, 8)).toBeNull()
    expect(pitchMenuShineStepOf(141, 8)).toBe(1)
  })

  it('이름 — 칸 1 · 3 왼쪽 맞춤, 2 · 4 상자 오른쪽 끝에 오른쪽 맞춤', () => {
    expect(pitchMenuLabelX(1, 100, [9, -58, 3, 5], 23)).toBe(109)
    expect(pitchMenuLabelX(2, 100, [-40, -32, 5, 5], 23)).toBe(100 - 40 + 5 - 23)
  })

  it('빛 지도 — 바탕 15, 앵커 20 위 지름 60 원은 31', () => {
    const anchor = { x: 83, y: 188 }
    expect(spotlightLevelAt(0, 0, anchor)).toBe(15)
    // 도장 왼쪽 위 = (41 − 15, 84 − 15) = (26, 69) — 가운데 줄 (15) 은 [0, 30)
    expect(spotlightLevelAt(26, 69 + 15, anchor)).toBe(31)
    expect(spotlightLevelAt(26, 69, anchor)).toBe(15)
    expect(spotlightLevelAt(26 + 11, 69, anchor)).toBe(31)
  })
})

describe('0x11 게이지 (0x4d412~)', () => {
  it('칸을 정하기 전 — 커서 0 · > 8 은 0x3a 한 장, 1..8 은 0x3b 위 min(0x3b + 커서, 0x43)', () => {
    expect(gaugeDrawsOf({ cursor: 0, pressed: 0, decidedTicks: 0 }).map((draw) => draw.frame)).toEqual([0x3a])
    expect(gaugeDrawsOf({ cursor: 9, pressed: 0, decidedTicks: 0 }).map((draw) => draw.frame)).toEqual([0x3a])
    expect(gaugeDrawsOf({ cursor: 8, pressed: 0, decidedTicks: 0 }).map((draw) => draw.frame)).toEqual([0x3b, 0x43])
  })

  it('정한 뒤 — 애니 1 이 끝나면 결과 원이 제자리에서 15 · 12 · 9 · 6 /16 으로 옅어진다', () => {
    const afterAnimation = gaugeDrawsOf({ cursor: 6, pressed: 6, decidedTicks: 5 })
    expect(afterAnimation).toEqual([
      // 멈춘 커서 반투명 8/16 · 결과 원은 자리 그대로 15/16 (4d6c4 효과 1 · 인자 15)
      { folder: './sprites/slt_pitch/frames', frame: 0x41, alpha: 8 / 16 },
      { folder: './sprites/slt_pitch/frames', frame: 0x41, alpha: 15 / 16 },
    ])
    expect(gaugeDrawsOf({ cursor: 6, pressed: 6, decidedTicks: 9 })).toHaveLength(1)
  })
})
