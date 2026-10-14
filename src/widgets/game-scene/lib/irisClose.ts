/**
 * **화면 전환 종류 7(원 닫기)의 한 그림** — 0xbd4b4 · 0xbd5bc 를 직접 떴다(벤치 클리어링 0x401d4 가 틱 100 에 건다).
 *
 * ```
 * bd4b4  0x1400678(W, H) — **화면 크기**(W × H) 그림 하나를 만들고 +0x30 = 240 · +0x34 = 240 (0xbdae8 이 넘긴 지름)
 * bd5bc  단계 n == 0 이면 안 그린다.  w = 240 / n · h = 240 / n (0xca7b5 나눗셈 — 0 쪽으로 버림)
 *        그림에 색 (0, 0, 0) 으로 0x14006e8 칠(0, 0, W, H)                         ; 화면 전체 검정
 *        색 (255, 0, 255) 으로 0x1400708 채운 호(cx − w/2, cy − h/2, w, h, 0, 360)  ; 구멍
 *        0x98975(gc, 그림, 0, 0, W, H, 0, 0, 0, 0, 1) — 화면 (0, 0) 에 찍는다
 * ```
 * cy = H/2 + [0x1221()+0x40] + 5 의 [0x1221()+0x40] 은 단말이 채우는 화면 버퍼 위쪽 여백이라 0 이다(`lib/rivalryBand` 머리말, ⚠️ 기기 값 미확인).
 * 가운데(cx, cy) 와 n 은 `widgets/field-walk` 의 `benchClearingIrisOf` 가 준다(x = cx − trunc(w/2) · y = cy − trunc(h/2) · size = w = h).
 *
 * ⚠️ 미확인: 0x1400708(채운 호)과 0x98975 의 (255, 0, 255) 투명 처리는 단말(플랫폼) 함수라 바이너리에 없다.
 * 웹은 MIDP `fillArc` 처럼 상자 (x, y, w, h) 안에서 **화소 가운데가 타원 안에 드는** 칸을 구멍으로 본다.
 */

export interface IrisSpan {
  readonly y: number
  /** 구멍 첫 칸 x */
  readonly from: number
  /** 구멍 끝 칸 x (포함) */
  readonly to: number
}

/** 상자 (x, y, size, size) 의 채운 원 — 줄마다 구멍 칸 */
export function irisHoleSpansOf(x: number, y: number, size: number): IrisSpan[] {
  if (size <= 0) return []
  const radius = size / 2
  const centerX = x + radius
  const centerY = y + radius
  const spans: IrisSpan[] = []
  for (let row = y; row < y + size; row += 1) {
    const dy = row + 0.5 - centerY
    const reach = radius * radius - dy * dy
    if (reach < 0) continue
    const half = Math.sqrt(reach)
    const from = Math.ceil(centerX - half - 0.5)
    const to = Math.floor(centerX + half - 0.5)
    if (to >= from) spans.push({ y: row, from, to })
  }
  return spans
}
