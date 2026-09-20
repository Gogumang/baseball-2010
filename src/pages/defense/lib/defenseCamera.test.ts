import { describe, expect, it } from 'vitest'
import {
  CAMERA_FOLLOW_PERCENT,
  cameraBoundsOf,
  centerOn,
  clampCamera,
  followCamera,
  screenOffsetOf,
  stepCamera,
  toWorldHeight,
  toWorldWidth,
  worldToScreen,
} from '@/pages/defense/lib/defenseCamera'

/**
 * 수비 화면 카메라 (R3-field-view 1절).
 * 240×320 화면이면 시야가 15483×20800 월드 단위다 (문서 1-1 의 예와 같은 식).
 */
const bounds = cameraBoundsOf(240, 320)

describe('시야 크기 (역배율 0xb9504)', () => {
  it('화면 240 폭은 월드 15483, 320 높이는 20800 이다', () => {
    expect(toWorldWidth(240)).toBe(15483)
    expect(toWorldHeight(320)).toBe(20800)
    expect(bounds).toEqual({ worldWidth: 40000, worldHeight: 32500, viewWidth: 15483, viewHeight: 20800 })
  })

  it('문서가 든 예 — 화면 폭 240 → 15483, 높이 320 → 20800', () => {
    expect(toWorldWidth(620)).toBe(40000)
    expect(toWorldHeight(500)).toBe(32500)
  })
})

describe('경계 자르기 vt30 (0xc062c)', () => {
  it('[0, W−Vw] × [0, H−Vh] 로 자른다', () => {
    expect(clampCamera(bounds, -5000, -5000)).toEqual({ x: 0, y: 0 })
    expect(clampCamera(bounds, 999999, 999999)).toEqual({ x: 24517, y: 11700 })
    expect(clampCamera(bounds, 1000, 2000)).toEqual({ x: 1000, y: 2000 })
  })

  it('시야가 월드보다 넓으면 0 이다 — 위 한계를 먼저 걸기 때문 (원본 순서 그대로)', () => {
    const wide = cameraBoundsOf(1240, 1000)
    expect(wide.viewWidth).toBeGreaterThan(wide.worldWidth)
    expect(clampCamera(wide, 5000, 5000)).toEqual({ x: 0, y: 0 })
  })
})

describe('가운데 맞추기 vt20 (0xc05f0)', () => {
  it('목표 = 대상 − 시야/2 를 자른 값이다', () => {
    // 투수판 (20000, 24500) — 세로는 아래 한계 11700 에 걸린다
    expect(centerOn(bounds, { x: 20000, z: 24500 })).toEqual({ x: 12259, y: 11700 })
  })

  it('왼쪽 위 구석을 보면 0,0 으로 잘린다', () => {
    expect(centerOn(bounds, { x: 0, z: 0 })).toEqual({ x: 0, y: 0 })
  })
})

describe('따라가기 vt28 (0xc0690) — 20%/틱', () => {
  it('차이의 20% 만큼 간다', () => {
    expect(followCamera({ x: 0, y: 0 }, { x: 1000, y: -1000 })).toEqual({ x: 200, y: -200 })
  })

  it('20% 가 0 으로 잘리면 부호만큼 ±1 간다', () => {
    expect(followCamera({ x: 0, y: 0 }, { x: 3, y: -3 })).toEqual({ x: 1, y: -1 })
    expect(followCamera({ x: 7, y: 7 }, { x: 7, y: 7 })).toEqual({ x: 7, y: 7 })
  })

  it('비율 1%/틱 (경기 끝 직전) 도 같은 식이다', () => {
    expect(followCamera({ x: 0, y: 0 }, { x: 1000, y: 0 }, 1)).toEqual({ x: 10, y: 0 })
  })
})

describe('한 틱 (0x3f060)', () => {
  const target = { x: 20000, z: 24500 }

  it('멈춰 있다가 첫 틱에 목표의 20% 만큼 다가간다', () => {
    expect(stepCamera(bounds, { x: 0, y: 0 }, target, CAMERA_FOLLOW_PERCENT)).toEqual({ x: 2451, y: 2340 })
  })

  it('계속 돌리면 ±1 규칙 덕에 목표에 딱 닿는다', () => {
    let camera = { x: 0, y: 0 }
    for (let i = 0; i < 200; i += 1) camera = stepCamera(bounds, camera, target)
    expect(camera).toEqual(centerOn(bounds, target))
  })

  it('목표를 자르므로 현재 위치가 월드 밖으로 나가지 않는다', () => {
    let camera = centerOn(bounds, { x: 0, z: 0 })
    for (let i = 0; i < 200; i += 1) camera = stepCamera(bounds, camera, { x: 40000, z: 32500 })
    expect(camera).toEqual({ x: 24517, y: 11700 })
  })
})

describe('화면 오프셋 0x41230 과 월드 → 화면', () => {
  it('오프셋은 카메라를 배율로 줄여 음수로 뒤집은 값이다', () => {
    expect(screenOffsetOf({ x: 12259, y: 11700 })).toEqual({ x: -190, y: -180 })
  })

  it('가운데를 보고 있으면 대상이 화면 가로 한가운데(120)에 온다', () => {
    const camera = centerOn(bounds, { x: 20000, z: 24500 })
    expect(worldToScreen(camera, { x: 20000, z: 24500 })).toEqual({ x: 120, y: 196 })
  })
})
