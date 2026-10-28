import { roundFillRectsOf } from '@/widgets/matchup-cards/lib/matchupCardsLayout'

/**
 * **운동장 전경의 이름표** — 0x4fb8c 의 4fbf6~4fe26 (직접 뜸 2026-10-14). 틱 > 100 일 때 +0x1b74 가 가리키는 수비수 머리 아래:
 * ```
 * 4fc06  칸 = 표 0xd044c[+0x1b74] ; 칸 ≠ 0 이면 선수 0x40008(장면, 칸)(수비 팀에서 레코드 +0x1c & 0xf == 칸 + 1),
 *        칸 0 이면 0xae83c(팀[st[0xa]])(지금 투수) — 선수가 없으면 아무것도 안 그린다
 * 4fcec  자리 = 0xb94b4(카메라, x, z − y) ; 상자 = (오프셋 x + 자리 x − 53/2, 오프셋 y + 자리 y + 5, 53, 15)
 * 4fd6c  0x6b7d4(상자, 둥글기 2, RGB(0x18, 0x24, 0x5a))
 * 4fda6  0x6b7d4(x + 1, y + 1, 53 − 2, 15 − 2, 2, RGB(0x18, 0x2c, 0x6b))
 * 4fdcc  0x6b7d4(x + 2, y + 2, 53 − 4, 15 − 15/2 − 2, 2, RGB(0x29, 0x3c, 0x8c))      ; 위쪽 반만 밝은 띠
 * 4fdfa  글 `"!C!cffffff" + 이름`(0xd09d0 · 0xb62c1) 을 0xba2e4(x, y, 53, 15, 글, 1, 0, 2, …) — 상자 가운데 흰 글씨
 * ```
 */
export const NAME_TAG_SIZE = { width: 0x35, height: 0xf } as const
const NAME_TAG_DROP = 5
const NAME_TAG_ROUND = 2

export interface NameTagPiece {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly color: string
}

/** 수비수 그림 자리(화면) 하나에서 이름표 상자 (4fd16~4fd4a) */
export function nameTagBoxOf(point: { readonly x: number; readonly y: number }) {
  const { width, height } = NAME_TAG_SIZE
  return { x: point.x - (width >> 1), y: point.y + NAME_TAG_DROP, width, height }
}

/** 둥근 칠 셋을 조각으로 — 그리는 차례대로 */
export function nameTagPiecesOf(box: {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}): readonly NameTagPiece[] {
  const { x, y, width: w, height: h } = box
  const layers = [
    { x, y, width: w, height: h, color: 'rgb(24, 36, 90)' },
    { x: x + 1, y: y + 1, width: w - 2, height: h - 2, color: 'rgb(24, 44, 107)' },
    { x: x + 2, y: y + 2, width: w - 4, height: h - Math.trunc(h / 2) - 2, color: 'rgb(41, 60, 140)' },
  ]
  return layers.flatMap((layer) => roundFillRectsOf({ ...layer, round: NAME_TAG_ROUND }).map((rect) => ({ ...rect, color: layer.color })))
}
