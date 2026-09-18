import { describe, expect, it } from 'vitest'
import { STAGE_LAYOUT, toPixel, toZoneCoordinate } from '@/widgets/batting-stage/lib/stageLayout'
import { RELEASE_PIXEL } from '@/widgets/batting-stage/lib/trajectory'

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
