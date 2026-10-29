export interface NumberGlyphPlacement {
  readonly index: number
  readonly x: number
  readonly y: number
}

/**
 * 숫자 그리기 **0xba51c(x, y, w, h, 자간, 값, 기준, 그림, 정렬, ox, oy)** (직접 떴다, 0xba51c~0xba67a).
 * ```
 * x0 = x + ox ; y0 = y + oy
 * 자리마다 Σ += 글자폭 + 자간 (끝 자리 뒤 자간까지) ; 최대높이 = max(글자높이)
 * 정렬 & 0x4  → x0 += w − Σ                    (ba594)
 * 정렬 & 0x20 → y0 += ceil((h − 최대높이) / 2)   (ba5a6 — 나머지를 위로 올린다)
 * 정렬 & 0x40 → y0 += h − 최대높이              (ba5c8)
 * 정렬 & 0x2  → x0 += (w − Σ) >> 1              (ba5dc)
 * 높은 자리부터 그림 (기준 + 숫자) 을 (x0, y0 + 최대높이 − 글자높이) 에 — 글자 아래 맞춤 — 그리고 x0 += 글자폭 + 자간
 * ```
 * 그림이 아직 안 읽혔으면 null.
 */
export function alignedNumberGlyphsOf(
  value: number,
  box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  options: { readonly spacing: number; readonly start: number; readonly align: number; readonly offsetX: number; readonly offsetY: number },
  sizeOf: (index: number) => { readonly width: number; readonly height: number } | null,
): NumberGlyphPlacement[] | null {
  const digits = [...String(Math.max(0, Math.trunc(value)))].map((digit) => options.start + Number(digit))
  const sizes = digits.map(sizeOf)
  if (sizes.some((size) => size === null)) return null
  const known = sizes as { readonly width: number; readonly height: number }[]
  const total = known.reduce((sum, size) => sum + size.width + options.spacing, 0)
  const maxHeight = known.reduce((max, size) => Math.max(max, size.height), 0)
  let x = box.x + options.offsetX
  let y = box.y + options.offsetY
  if ((options.align & 0x4) !== 0) x += box.width - total
  if ((options.align & 0x20) !== 0) {
    const gap = box.height - maxHeight
    y += (gap >> 1) + (gap - Math.trunc(gap / 2) * 2)
  }
  if ((options.align & 0x40) !== 0) y += box.height - maxHeight
  if ((options.align & 0x2) !== 0) x += (box.width - total) >> 1
  return digits.map((index, order) => {
    const size = known[order]
    const glyph = { index, x, y: y + maxHeight - size.height }
    x += size.width + options.spacing
    return glyph
  })
}
