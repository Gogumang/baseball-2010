/** 565 로 읽어 둔 그림 — `opaque[i]` 가 0 이면 투명 칸(원본 PZX 의 투명색 · 웹 PNG 알파 0) */
export interface Sprite565 {
  readonly width: number
  readonly height: number
  readonly pixels: Uint16Array
  readonly opaque: Uint8Array
}

/** 그림 한 장을 (x, y) 에 효과로 — 0x985ed 표의 효과 번호(효과 4 흔들기는 다루지 않는다) */
export interface ComposeImageOp {
  readonly kind: 'image'
  readonly src: string
  readonly x: number
  readonly y: number
  readonly effect?: number
  readonly argument?: number
  /** 좌우 뒤집어 그린다 (효과 0x11 · CSS `scaleX(-1)` 겹) — 칸 (x + c) 에 그림 열 (w − 1 − c) */
  readonly flipX?: boolean
}

/**
 * 사각형 단계 덮기 — `color` 가 null 이면 [0x15605d4] 검정 0x9b234(몸통 0x9aac4), 아니면 [0x15605d0] 색 0x9b3f4(몸통 0x9a52c, 565 색).
 * 감싸는 함수처럼 화면 안으로 자른다.
 */
export interface ComposeCoverOp {
  readonly kind: 'cover'
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly step: number
  readonly color: number | null
}

export type ComposeOp = ComposeImageOp | ComposeCoverOp
