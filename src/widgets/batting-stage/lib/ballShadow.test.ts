import { describe, expect, it } from 'vitest'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { ballShadowPiecesAt } from '@/shared/lib/ballShadow/ballShadowPieces'
import { ballDepthAt, ballPixelAt, ballShadowAt } from '@/widgets/batting-stage/lib/trajectory'
import { StageDrawList } from '@/widgets/batting-stage/lib/renderBattingStage'

/** 경로 점 셋 — 투영 값은 unicorn 으로 0xbe3d8 · 0xbe384 를 돌린 값(`_raw/verify/r271_emu_projection.py`)과 같은 점이다 */
const 공: Pitch = {
  type: 'FASTBALL',
  plate: { x: 0, y: 0 },
  breakOffset: { x: 0, y: 0 },
  flightDurationMilliseconds: 3 * 62,
  frameCount: 3,
  controlTier: 3,
  worldPath: [
    { x: 20000, y: 1500, z: 24600 },
    { x: 20300, y: 900, z: 26000 },
    { x: 20585, y: 1202, z: 29705 },
  ],
  stageSide: 1,
}

describe('타석 공 그림자 0x3b2f4 3b388~3b422 (r271)', () => {
  it('가로는 공 점의 투영 그대로(3b35a), 세로는 높이 0 으로 내린 점의 투영 + 2 — 크기는 max(공 크기 − 4, 2)', () => {
    // 공 (20585, 1202, 29705): 투영 (34, −67) · 땅점 (28, −105) → 원점 (203, 258) + 카메라 (−120, −70)
    expect(ballPixelAt(공, 2)).toEqual({ x: 117, y: 255 })
    expect(ballShadowAt(공, 2)).toEqual({ x: 117, y: 293 + 2, size: 5 })
    // 공 (20300, 900, 26000): 투영 (7, 4) · 땅점 (7, −13) · 크기 칸 trunc(1400 · 10 / 5105) = 2 → 그림자 2
    expect(ballShadowAt(공, 1)).toEqual({ x: 90, y: 201 + 2, size: 2 })
  })

  it('공 틱 0 이면 없다(3b38c) · 틱은 N − 1 에 잘린다(0x35820)', () => {
    expect(ballShadowAt(공, 0)).toBeNull()
    expect(ballShadowAt(공, 4)).toEqual(ballShadowAt(공, 2))
  })

  it('상태 0x11 은 땅점 y + 크기 ≥ 화면 높이면 안 그리고(3b3f8), 0x13 은 늘 그린다', () => {
    const 가까운공: Pitch = { ...공, worldPath: [{ x: 20000, y: 1500, z: 24600 }, { x: 20000, y: 3470, z: 31490 }], frameCount: 2 }
    expect(ballShadowAt(가까운공, 1)).toBeNull()
    expect(ballShadowAt(가까운공, 1, true)).not.toBeNull()
  })

  it('곡선이 없는 대체 공은 월드 점이 없어 그림자도 없다', () => {
    expect(ballShadowAt({ ...공, worldPath: null }, 1)).toBeNull()
  })

  it('그림자 조각 0x356f8 — (s + 1)² 검정 위 회색 선 넷, s ≤ 2 면 검정만', () => {
    expect(ballShadowPiecesAt(117, 295, 5)).toEqual([
      { x: 115, y: 293, width: 6, height: 6, color: { r: 0, g: 0, b: 0 } },
      { x: 114, y: 294, width: 1, height: 4, color: { r: 100, g: 100, b: 100 } },
      { x: 121, y: 294, width: 1, height: 4, color: { r: 100, g: 100, b: 100 } },
      { x: 116, y: 292, width: 4, height: 1, color: { r: 100, g: 100, b: 100 } },
      { x: 116, y: 299, width: 4, height: 1, color: { r: 100, g: 100, b: 100 } },
    ])
    expect(ballShadowPiecesAt(90, 203, 2)).toEqual([{ x: 89, y: 202, width: 3, height: 3, color: { r: 0, g: 0, b: 0 } }])
  })
})

describe('공 그리기 목록 깊이 [sp+0x88] — 경로 점의 월드 z (Q-02, r271)', () => {
  it('공 틱의 점 z 이고 N − 1 에 잘린다', () => {
    expect(ballDepthAt(공, 0)).toBe(24600)
    expect(ballDepthAt(공, 1)).toBe(26000)
    expect(ballDepthAt(공, 9)).toBe(29705)
    expect(ballDepthAt({ ...공, worldPath: null }, 1)).toBeNull()
  })
})

describe('그리기 목록 0xbe810 — 깊이 오름차순, 같은 깊이는 넣은 차례 (Q-02)', () => {
  const orderOf = (ballDepth: number) => {
    const drawn: string[] = []
    const list = new StageDrawList()
    list.add(24500, () => drawn.push('투수'))
    list.add(29705, () => drawn.push('타자'))
    list.add(29705, () => drawn.push('게이지'))
    list.add(ballDepth + 1, () => drawn.push('마구 이펙트'))
    list.add(ballDepth, () => drawn.push('공'))
    list.add(ballDepth, () => drawn.push('강속구 불꽃'))
    list.flush()
    return drawn
  }

  it('날아오는 공(z < 29705)은 타자 · 투구 UI 밑, 투수(24500)와 같은 깊이면 투수 위', () => {
    expect(orderOf(26000)).toEqual(['투수', '공', '강속구 불꽃', '마구 이펙트', '타자', '게이지'])
    expect(orderOf(24500)).toEqual(['투수', '공', '강속구 불꽃', '마구 이펙트', '타자', '게이지'])
  })

  it('도착점(z = 29705)의 공은 넣은 차례가 뒤라 타자 · 게이지 위', () => {
    expect(orderOf(29705)).toEqual(['투수', '타자', '게이지', '공', '강속구 불꽃', '마구 이펙트'])
  })
})
