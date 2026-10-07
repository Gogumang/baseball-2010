import type { MapBox } from '@/shared/config/outingPlaces'

/** 0xb9db0~0xb9dc4 세로 가운데: `(d >> 1) + (d − trunc(d / 2) × 2)` — 홀수면 1 을 더 내린다 */
const verticalCenterOffsetOf = (d: number) => (d >> 1) + (d - Math.trunc(d / 2) * 2)

/**
 * 외출 지도 장소 이름의 왼쪽 위 — 0x7eb66~0x7eb98 → 0x7e300 → 0xb9d74(정렬 0x22) (F-2 2-4 확정).
 * x += (bw − fw) >> 1 · y += (d >> 1) + d 의 홀짝.
 * **박스에는 mapX/mapY 를 더하지 않는다** (0x7e39e~0x7e3a2 — y 보정 인자 0). 화면 높이 320 이면 건물·[!]·화살표·말풍선은
 * mapY(11) 만큼 내려가고 이름만 11px 위에 찍힌다 — 원본 그대로 옮긴다.
 */
export function placeLabelTopLeftOf(nameBox: MapBox, labelWidth: number, labelHeight: number): { x: number; y: number } {
  return {
    x: nameBox.x + ((nameBox.width - labelWidth) >> 1),
    y: nameBox.y + verticalCenterOffsetOf(nameBox.height - labelHeight),
  }
}
