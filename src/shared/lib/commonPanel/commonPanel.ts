/**
 * **공용 판 `0x55e60` 과 안쪽 칸 `0xbb28c` 의 칠 목록** — 둘 다 직접 떴다(0x55e60~0x561f0 · 0xbb28c~0xbb388).
 * 그림은 판 왼쪽 위를 (0, 0) 으로 한 칠 칸(`PanelPaint`) 목록이고, 차례대로 칠하면 원본과 같은 점이 나온다(뒤 칸이 앞 칸을 덮는다).
 *
 * 기본 칠하기(모두 직접 뜬 함수, R = x + w · B = y + h):
 * ```
 * 0x6a9f0 네모 칠 (x, y, w, h, 색)            — w × h
 * 0x6a904 선 (x1, y1, x2, y2, 색)            — 기기 선 [0x14006c8], 두 끝을 다 칠한다
 * 0x6a8a8 점 (x, y, 색)                       — 0x6a85c, 화면 밖이면 안 찍는다
 * 0x6b7d4 둥근 칠 (x, y, w, h, 둥글기 ≤ 3, 색) — 칠(x+1, y+1, w−1, h−1) + 선 (x+1, y)–(R−1, y) · (x+1, B)–(R−1, B) ·
 *                                               (x, y+1)–(x, B−1) · (R, y+1)–(R, B−1) → (w+1)×(h+1), 네 모서리 점은 빈다
 * 0x6aa64 둥근 테두리 (x, y, w, h, 둥글기 ≤ 3, 색) — 위 선 넷만 (0x6aa9c~0x6ab0e)
 * ```
 * 색 인자의 윗바이트는 알파다(0 · 0xff 면 불투명). 이 판을 부르는 자리는 모두 다섯째 인자(알파) 0 이라 불투명만 옮긴다.
 *
 * 쪼갠 파일: `panelPaint`(칠 칸 · 기본 칠하기 · 정렬) · `commonPanelPaints`(공용 판 0x55e60) · `insetBox`(안쪽 칸 0xbb28c) · `roundBox`(둥근 칸 0x5eec4)
 */
export { alignedTopLeftOf, roundEdgePaintsOf, roundFillPaintsOf, type PanelPaint } from '@/shared/lib/commonPanel/panelPaint'
export { commonPanelPaintsOf, type CommonPanelOptions } from '@/shared/lib/commonPanel/commonPanelPaints'
export { insetBoxPaintsOf } from '@/shared/lib/commonPanel/insetBox'
export { roundBoxPaintsOf, type RoundBoxOptions } from '@/shared/lib/commonPanel/roundBox'
