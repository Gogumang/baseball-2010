import type { Coordinate } from '@/shared/lib/geometry/coordinate'

/**
 * 타석 화면 배치 — binary.mod 에서 바이트로 확인한 원본 좌표 (위치 분석 에이전트, 2026-09-17).
 *
 * 카메라는 월드 480×390 을 centerOn(240, 390 − H/2) 로 보며, H=320 이면 화면 오프셋 (−120, −70) 이다.
 *   그라운드 attack/000: 위쪽 y = −70 + 226 = 156, 왼쪽 x = −193 (반전 없음, 0x7725c) → 156+164 = 320 로 바닥에 닿는다
 *   타자 앵커: 표 0xcfb2c — 우타 (184,351) · 좌타 (295,351)
 *   투수 앵커: 표 0xcfb18 — 우타 (276,258) · 좌타 (203,258)
 *   스트라이크 존 표시: 표 0xcfb7c — 우타 (226,310,33,33) · 좌타 (221,310,33,33)
 *   판정 글자 중심: (117, 224) (0x39504)
 *   배경(하늘·구름·펜스·관중석)은 renderScenery · 투수 단계와 판정 애니는 stageScenery (위치 분석 6차)
 * **추정**으로 남은 것: 화면 높이 320(기기에 따라 400 이면 y 가 70 커진다).
 */

/**
 * 배치 side = **타자 손** (0xb63c0): **0 우타 · 1 좌타** (C-5 확정).
 * 원본 타자 그림은 좌타 자세로 그려져 있어 좌타(1)는 그대로, 우타(0)는 효과 0x11 로 뒤집어 그린다.
 * 구장(+0x60)도 같은 값을 받아 **우타 때 펜스·관중·전광판이 통째로 뒤집힌다** (R6 4절).
 *
 * 선수 레코드 폼(`rec[0xb]` 윗니블 = `2 × 타입 + 손`)의 **낮은 비트**가 곧 이 값이다.
 */
export const BATTER_SIDE = { 우타: 0, 좌타: 1 } as const

/** 폼에서 손만 뽑는다 (0x78ab0 이 몸통을 `폼 >> 1` 로 고르는 것과 같은 자리) */
export function batterSideOfForm(form: number): number {
  return form & 1
}

/** side 를 못 받았을 때 쓰는 기본 배치 — 예전부터 그리던 좌타 쪽이다 */
export const STAGE_SIDE: number = BATTER_SIDE.좌타

export const STAGE_WIDTH = 240
export const STAGE_HEIGHT = 320

const ZONE_SIZE = 33

/**
 * side 별 배치 — 전부 원본 표를 카메라 오프셋만큼 옮긴 값이다.
 * 존은 좌우 거울이 아니라 5px 만 다르다 — 표에 두 쪽이 따로 적혀 있다.
 */
const SIDE_LAYOUTS = [
  { batterAnchor: { x: 64, y: 281 }, pitcherAnchor: { x: 156, y: 188 }, zoneLeft: 106, zoneTop: 240 },
  { batterAnchor: { x: 175, y: 281 }, pitcherAnchor: { x: 83, y: 188 }, zoneLeft: 101, zoneTop: 240 },
] as const

/** side 를 안 타는 배치. 그라운드는 **반전 없이** 늘 같은 자리에 깔린다 (0x7725c) */
const COMMON_LAYOUT = {
  fieldTopY: 156,
  fieldSourceX: 193,
  judgeCenter: { x: 117, y: 224 },
} as const

export function stageLayoutOf(side: number = STAGE_SIDE) {
  return { ...COMMON_LAYOUT, ...(SIDE_LAYOUTS[side] ?? SIDE_LAYOUTS[BATTER_SIDE.좌타]) }
}

/** 예전 호출부가 쓰던 좌타 배치 */
export const STAGE_LAYOUT = stageLayoutOf(STAGE_SIDE)

/** 존 좌표 1.0 이 차지하는 픽셀 (33px 존의 절반) */
export const ZONE_HALF_PIXELS = ZONE_SIZE / 2

function zoneCenterOf(side: number): { x: number; y: number } {
  const { zoneLeft, zoneTop } = stageLayoutOf(side)
  return { x: zoneLeft + ZONE_HALF_PIXELS, y: zoneTop + ZONE_HALF_PIXELS }
}

export function toPixel(point: Coordinate, side: number = STAGE_SIDE): { x: number; y: number } {
  const center = zoneCenterOf(side)
  return {
    x: center.x + point.x * ZONE_HALF_PIXELS,
    y: center.y - point.y * ZONE_HALF_PIXELS,
  }
}

export function toZoneCoordinate(pixelX: number, pixelY: number, side: number = STAGE_SIDE): Coordinate {
  const center = zoneCenterOf(side)
  return {
    x: (pixelX - center.x) / ZONE_HALF_PIXELS,
    y: (center.y - pixelY) / ZONE_HALF_PIXELS,
  }
}
