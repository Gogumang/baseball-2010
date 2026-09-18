import type { Coordinate } from '@/shared/lib/geometry/coordinate'

/**
 * 타석 화면 배치 — binary.mod 에서 바이트로 확인한 원본 좌표 (위치 분석 에이전트, 2026-09-17).
 *
 * 카메라는 월드 480×390 을 centerOn(240, 390 − H/2) 로 보며, H=320 이면 화면 오프셋 (−120, −70) 이다.
 *   그라운드 attack/000: 위쪽 y = −70 + 226 = 156, 왼쪽 x = −193 (반전 없음, 0x7725c) → 156+164 = 320 로 바닥에 닿는다
 *   타자 앵커: 표 0xcfb2c (295, 351) − 오프셋 = (175, 281)
 *   투수 앵커: 표 0xcfb18 (203, 258) − 오프셋 = (83, 188)
 *   스트라이크 존 표시: 표 0xcfb7c (221, 310, 33, 33) − 오프셋 = (101, 240, 33, 33)
 *   판정 글자 중심: (117, 224) (0x39504)
 *   배경(하늘·구름·펜스·관중석)은 renderScenery · 투수 단계와 판정 애니는 stageScenery (위치 분석 6차)
 * **추정**으로 남은 것: 화면 높이 320(기기에 따라 400 이면 y 가 70 커진다). 우타(side0) 배치는 옮기지 않았다
 * (원본: 타자 (64,281) 반전, 펜스 x 370 반전, 관중석 x 10).
 */
/**
 * 웹 타석 화면이 쓰는 배치 side. 투수 앵커 (83,188) = 투구 원점 표 0xcfb18 의 side1 (203,258) 이고,
 * 존 표시 (101,240) 도 side1 기준점 (237,326) 과 맞는다. 원본은 side 를 타자 좌우(0xb63c0)로 정하므로
 * 웹 타자도 side1(좌타, 위치 분석 3차) 로 본다 — 타자 그림이 반전되지 않는 쪽이다.
 */
export const STAGE_SIDE = 1

export const STAGE_WIDTH = 240
export const STAGE_HEIGHT = 320

const ZONE_LEFT = 101
const ZONE_TOP = 240
const ZONE_SIZE = 33

export const STAGE_LAYOUT = {
  fieldTopY: 156,
  fieldSourceX: 193,
  batterAnchor: { x: 175, y: 281 },
  pitcherAnchor: { x: 83, y: 188 },
  judgeCenter: { x: 117, y: 224 },
} as const

/** 존 좌표 1.0 이 차지하는 픽셀 (33px 존의 절반) */
export const ZONE_HALF_PIXELS = ZONE_SIZE / 2
const ZONE_CENTER_X = ZONE_LEFT + ZONE_HALF_PIXELS
const ZONE_CENTER_Y = ZONE_TOP + ZONE_HALF_PIXELS

export function toPixel(point: Coordinate): { x: number; y: number } {
  return {
    x: ZONE_CENTER_X + point.x * ZONE_HALF_PIXELS,
    y: ZONE_CENTER_Y - point.y * ZONE_HALF_PIXELS,
  }
}

export function toZoneCoordinate(pixelX: number, pixelY: number): Coordinate {
  return {
    x: (pixelX - ZONE_CENTER_X) / ZONE_HALF_PIXELS,
    y: (ZONE_CENTER_Y - pixelY) / ZONE_HALF_PIXELS,
  }
}
