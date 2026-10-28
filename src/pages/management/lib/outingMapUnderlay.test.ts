import { describe, expect, it } from 'vitest'
import { NIGHT_DIM_STEP, OUTING_MAP_ORIGIN, outingMapComposeOps, outingMapUnderlayLayoutOf } from '@/pages/management/lib/outingMapUnderlay'
import { MAP_FRAMES } from '@/shared/config/outingPlaces'
import { DRAW_EFFECT } from '@/shared/lib/pixelEffect/pixelEffect'

describe('이벤트 대화창 0x8b5ac 의 지도 갈래 — 0x7ea64(gfx, −1, 0)', () => {
  it('지도 원점은 (0, 11) — 프레임 0(240×297) 가운데 정렬', () => {
    expect(OUTING_MAP_ORIGIN).toEqual({ x: 0, y: 11 })
  })

  it('이름은 박스 0 에 정렬 0x22 — mapY 를 안 더하고, 테두리 그림이라 1px 왼쪽 위', () => {
    const { labels } = outingMapUnderlayLayoutOf(12)
    // 경기장 박스 (92,166,39,16) · 글 31×10 → x 92 + 4 · y 166 + 3
    expect(labels[0]).toEqual({ frame: 229, left: 95, top: 168 })
    // 병원 박스 (7,137,30,13) · 글 20×10 → d = 3 이면 1 + 1 = 2 내린다
    expect(labels[2]).toEqual({ frame: 231, left: 11, top: 138 })
  })

  it('[!] 기준점 — 박스 2 의 (mapX + x + w>>1, mapY + y)', () => {
    expect(outingMapUnderlayLayoutOf(12).markers[0]).toEqual({ placeId: 'stadium', x: 141, y: 167 })
  })

  it('밤(시간대 2 = 20~5시)만 단계 9 로 어둡게 — 9/16 남긴다', () => {
    expect([5, 6, 15, 16, 19, 20].map((hour) => outingMapUnderlayLayoutOf(hour).isNight)).toEqual([true, false, false, false, false, true])
    expect(NIGHT_DIM_STEP).toBe(9)
  })
})

describe('외출 지도 밑그림 겹 — 원본 화면 버퍼 차례 (`ComposedScreen`)', () => {
  const origins = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((frame) => [String(frame).padStart(3, '0'), { x: frame, y: 0, width: 1, height: 1 }]))

  it('고른 칸이 있으면 고르지 않은 건물은 효과 1 · 7(0x9a449), 고른 건물은 빠진다', () => {
    const ops = outingMapComposeOps({ origins, mapX: 0, mapY: 11, selected: 1, labelOf: () => [], isNight: false })
    expect(ops.map((op) => (op.kind === 'image' ? [op.src.slice(-7), op.effect, op.argument] : op.kind))).toEqual([
      ['000.png', DRAW_EFFECT.COPY, 0],
      ['001.png', DRAW_EFFECT.TRANSLUCENT, 7],
      ['003.png', DRAW_EFFECT.TRANSLUCENT, 7],
      ['004.png', DRAW_EFFECT.TRANSLUCENT, 7],
      ['005.png', DRAW_EFFECT.TRANSLUCENT, 7],
    ])
  })

  it('sel = −1 이면 건물 다섯 효과 0 · 이름은 제 건물 바로 뒤(고리 0x7eb0a~0x7eba0) · 밤이면 그 뒤에 화면 전체 검정 단계 9 와 창문 프레임 6', () => {
    const label = { kind: 'image', src: 'label.png', x: 3, y: 4 } as const
    const ops = outingMapComposeOps({ origins, mapX: 0, mapY: 11, selected: -1, labelOf: (index) => (index === 4 ? [label] : []), isNight: true })
    expect(ops.slice(1, 6).every((op) => op.kind === 'image' && op.effect === DRAW_EFFECT.COPY)).toBe(true)
    expect(ops.slice(6)).toEqual([
      label,
      { kind: 'cover', x: 0, y: 0, width: 240, height: 320, step: NIGHT_DIM_STEP, color: null },
      { kind: 'image', src: `${MAP_FRAMES}/006.png`, x: 6, y: 11, effect: DRAW_EFFECT.COPY, argument: 0 },
    ])
  })
})
