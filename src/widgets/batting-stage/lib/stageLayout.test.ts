import { describe, expect, it } from 'vitest'
import {
  BATTER_SIDE,
  batterSideOfForm,
  stageLayoutOf,
  STAGE_LAYOUT,
  toPixel,
  toZoneCoordinate,
} from '@/widgets/batting-stage/lib/stageLayout'
import { RELEASE_PIXEL } from '@/widgets/batting-stage/lib/trajectory'
import { pitchSituationOf, situationOf } from '@/widgets/batting-stage/lib/stageText'

/** 위치 분석 에이전트가 binary.mod 에서 바이트로 확인한 값 (화면 높이 320, side1=반전 없음) */
describe('타석 화면 배치 — 원본 좌표', () => {
  it('그라운드 그림은 y=156 부터 화면 바닥(156+164=320)까지, x 193 부터 잘라 쓴다 (0x7725c)', () => {
    expect(STAGE_LAYOUT.fieldTopY).toBe(156)
    expect(STAGE_LAYOUT.fieldSourceX).toBe(193)
  })

  it('타자 앵커 (175,281), 투수 앵커 (83,188) (표 0xcfb2c, 0xcfb18)', () => {
    expect(STAGE_LAYOUT.batterAnchor).toEqual({ x: 175, y: 281 })
    expect(STAGE_LAYOUT.pitcherAnchor).toEqual({ x: 83, y: 188 })
  })

  it('스트라이크 존은 (101,240) 에서 33×33 이다 (표 0xcfb7c)', () => {
    expect(toPixel({ x: -1, y: 1 })).toEqual({ x: 101, y: 240 })
    expect(toPixel({ x: 1, y: -1 })).toEqual({ x: 134, y: 273 })
  })

  it('판정 글자 중심은 (117,224) 다 (0x39504)', () => {
    expect(STAGE_LAYOUT.judgeCenter).toEqual({ x: 117, y: 224 })
  })

  it('화면 좌표와 존 좌표는 서로 되돌려진다', () => {
    const point = { x: 0.4, y: -0.3 }
    const back = toZoneCoordinate(toPixel(point).x, toPixel(point).y)

    expect(back.x).toBeCloseTo(point.x, 10)
    expect(back.y).toBeCloseTo(point.y, 10)
  })

  it('공은 투수 손 근처(마운드 위쪽)에서 출발한다', () => {
    const release = RELEASE_PIXEL

    expect(Math.abs(release.x - STAGE_LAYOUT.pitcherAnchor.x)).toBeLessThan(15)
    expect(release.y).toBeLessThan(STAGE_LAYOUT.pitcherAnchor.y)
  })
})

describe('타자 좌우 — side 0 우타 · 1 좌타 (0xb63c0)', () => {
  it('폼의 낮은 비트가 손이다 — 폼 = 2×타입 + 손', () => {
    expect(batterSideOfForm(0)).toBe(BATTER_SIDE.우타) // 타격형 우타
    expect(batterSideOfForm(1)).toBe(BATTER_SIDE.좌타) // 타격형 좌타
    expect(batterSideOfForm(2)).toBe(BATTER_SIDE.우타) // 장타형 우타
    expect(batterSideOfForm(3)).toBe(BATTER_SIDE.좌타) // 장타형 좌타
  })

  it('우타 앵커는 표 0xcfb2c·0xcfb18 의 우타 칸이다 — 타자 (64,281) · 투수 (156,188)', () => {
    expect(stageLayoutOf(BATTER_SIDE.우타).batterAnchor).toEqual({ x: 64, y: 281 })
    expect(stageLayoutOf(BATTER_SIDE.우타).pitcherAnchor).toEqual({ x: 156, y: 188 })
  })

  it('우타 존은 좌우 거울이 아니라 5px 만 오른쪽이다 (표 0xcfb7c)', () => {
    expect(toPixel({ x: -1, y: 1 }, BATTER_SIDE.우타)).toEqual({ x: 106, y: 240 })
    expect(toPixel({ x: -1, y: 1 }, BATTER_SIDE.좌타)).toEqual({ x: 101, y: 240 })
  })

  it('존 좌표 되돌리기도 side 를 따라간다', () => {
    const pixel = toPixel({ x: 0.5, y: -0.5 }, BATTER_SIDE.우타)
    const back = toZoneCoordinate(pixel.x, pixel.y, BATTER_SIDE.우타)

    expect(back.x).toBeCloseTo(0.5, 10)
    expect(back.y).toBeCloseTo(-0.5, 10)
  })

  it('그라운드는 side 를 타지 않는다 (0x7725c 반전 없음)', () => {
    expect(stageLayoutOf(BATTER_SIDE.우타).fieldSourceX).toBe(stageLayoutOf(BATTER_SIDE.좌타).fieldSourceX)
    expect(stageLayoutOf(BATTER_SIDE.우타).judgeCenter).toEqual(stageLayoutOf(BATTER_SIDE.좌타).judgeCenter)
  })

  it('모르는 side 는 좌타 배치로 떨어진다', () => {
    expect(stageLayoutOf(7)).toEqual(stageLayoutOf(BATTER_SIDE.좌타))
  })

  it('스윙 스킬·CPU 투구 상황도 타자 손을 그대로 받는다 (예전엔 1 고정이었다)', () => {
    expect(situationOf(null, [], 0).batterSide).toBe(BATTER_SIDE.우타)
    expect(situationOf(null, [], 3).batterSide).toBe(BATTER_SIDE.좌타)
    expect(pitchSituationOf(null, 2).side).toBe(BATTER_SIDE.우타)
    expect(pitchSituationOf(null, 1).side).toBe(BATTER_SIDE.좌타)
  })
})
