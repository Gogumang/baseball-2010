export interface CutInPoint {
  readonly x: number
  readonly y: number
}

/** 색 — 알파는 0~255(0 · 255 는 불투명, 0x6a905 · 0x6a9f1) */
export interface CutInColor {
  readonly r: number
  readonly g: number
  readonly b: number
  readonly alpha: number
}

export interface CutInPolygon {
  readonly points: readonly CutInPoint[]
  readonly fill: CutInColor
  readonly border: CutInColor
}

export interface CutInLine {
  readonly from: CutInPoint
  readonly to: CutInPoint
  readonly color: CutInColor
}

/** 한 그림에 그릴 것 — 그리는 차례대로 */
export interface AceCutInDraw {
  /** 이 그림을 시작할 때의 단계 [+0x196c] */
  readonly stage: number
  readonly band: { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly color: CutInColor }
  /** game_ui 프레임 (속도선) 과 그 자리 — 단계 −1 이면 없음 */
  readonly speedLines: { readonly frame: number; readonly x: number; readonly y: number } | null
  readonly banner: CutInPolygon
  readonly bannerShadows: readonly CutInLine[]
  /** game_ui 이미지 96 · 95 (효과 2 · 230) */
  readonly streaks: readonly { readonly image: number; readonly x: number; readonly y: number }[]
  readonly sweep: CutInPolygon | null
  /** 초상 자리 — x 가 `'centered'` 면 W − 폭/2 − 5 */
  readonly portrait: { readonly x: number | 'centered'; readonly y: number } | null
  /** game_ui 이미지 93 ("CHANGE") — `brighten` 은 0xbb91d 종류 8 의 b */
  readonly label: { readonly image: number; readonly x: number; readonly y: number; readonly brighten: number } | null
  /** 이 그림이 단계 22 를 보고 메시지 13 을 보냈다 — 다음 그림부터 0xd */
  readonly ends: boolean
}
