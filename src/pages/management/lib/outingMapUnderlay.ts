import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import { backgroundFrameOf } from '@/pages/management/lib/managementLayout'

/**
 * 외출 지도 0x7ea64 를 고른 칸 −1 · 이름숨김 0 으로 부를 때(이벤트 대화창 0x8b5ac 의 지도 갈래)의 자리 — 직접 떴다.
 *
 * - 지도 원점 0x7eaa4~0x7eada: `((W − (x0 + w)) >> 1, (H − (y0 + h)) >> 1)`, 프레임 0 = (0,0) 240×297 → (0, 11).
 * - 이름 0x7eb66~0x7eb98: img_text 0xd47a6[i] = 229~233 을 박스 0 에 정렬 0x22(0xb9d74: x += (bw − fw) >> 1 ·
 *   y += (d >> 1) + d 의 홀짝, d = bh − fh). **박스에는 mapX/mapY 를 더하지 않는다.** 그림(`map_label_*`)은 8방향 1px 테두리를 둘러
 *   글자보다 1px 왼쪽 위에서 시작한다.
 * - 밤 0x7eba2: 시간대 [gfx+0x1c] == 2 이면 [0x15605d4] 단계 9 — 검정 몸통 0x9b234 는 화면을 단계/16 남긴다(P6 7-2).
 * - [!] 0x7ed6c: 박스 2 의 `(mapX + bx + (bw >> 1), mapY + by)`.
 */
export const OUTING_MAP_ORIGIN = { x: 0, y: 11 } as const
/** img_text 229~233 — 높이는 모두 10 */
const PLACE_LABEL_HEIGHT = 10
const PLACE_LABEL_WIDTHS: Readonly<Record<number, number>> = { 229: 31, 230: 33, 231: 20, 232: 22, 233: 32 }
/** 밤 어둡게 단계 9 */
export const NIGHT_DIM_STEP = 9

export interface OutingMapUnderlayLayout {
  readonly mapX: number
  readonly mapY: number
  readonly labels: readonly { readonly frame: number; readonly left: number; readonly top: number }[]
  readonly isNight: boolean
  /** 덮개 진하기 — 1 − 단계/16 */
  readonly nightDim: number
  readonly markers: readonly { readonly placeId: string; readonly x: number; readonly y: number }[]
}

/** 0xb9db0~0xb9dc4: `(d >> 1) + (d − trunc(d / 2) × 2)` — 홀수면 1 을 더 내린다 */
function verticalCenterOffsetOf(d: number): number {
  return (d >> 1) + (d - Math.trunc(d / 2) * 2)
}

export function outingMapUnderlayLayoutOf(hour: number): OutingMapUnderlayLayout {
  const { x: mapX, y: mapY } = OUTING_MAP_ORIGIN
  return {
    mapX,
    mapY,
    labels: OUTING_PLACES.map((place) => {
      const width = PLACE_LABEL_WIDTHS[place.labelFrame] ?? 0
      return {
        frame: place.labelFrame,
        left: place.nameBox.x + ((place.nameBox.width - width) >> 1) - 1,
        top: place.nameBox.y + verticalCenterOffsetOf(place.nameBox.height - PLACE_LABEL_HEIGHT) - 1,
      }
    }),
    // 시간대 0xb8fbd: 6~15 → 0 · 16~19 → 1 · 그 밖 → 2 (상태판 바탕 프레임과 같은 값)
    isNight: backgroundFrameOf(hour) === 2,
    nightDim: 1 - NIGHT_DIM_STEP / 16,
    markers: OUTING_PLACES.map((place) => ({
      placeId: place.id,
      x: mapX + place.markerBox.x + (place.markerBox.width >> 1),
      y: mapY + place.markerBox.y,
    })),
  }
}
