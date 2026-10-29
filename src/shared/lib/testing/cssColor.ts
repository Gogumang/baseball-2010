/**
 * **시험 전용** — 인라인 style 의 색 글을 `rgb(r, g, b)` · `rgba(r, g, b, a)`(알파 소수 셋째 자리) 꼴로 맞춘다.
 * 시험 DOM(happy-dom)은 적은 글(`#FFFF00`)을 그대로 돌려주고, 브라우저는 `rgb(255, 255, 0)` 로 바꿔 돌려준다(r364).
 * 시험은 "어떤 색인지"를 보므로 꼴을 하나로 맞춰 비교한다.
 */
const HEX_COLOR = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i
const RGBA_COLOR = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/
const ALPHA_DIGITS = 3

export function cssColor(value: string | undefined | null): string {
  const text = (value ?? '').trim()
  const hex = HEX_COLOR.exec(text)
  if (hex !== null)
    return `rgb(${hex
      .slice(1, 4)
      .map((pair) => Number.parseInt(pair, 16))
      .join(', ')})`
  const rgba = RGBA_COLOR.exec(text)
  if (rgba !== null) return `rgba(${rgba[1]}, ${rgba[2]}, ${rgba[3]}, ${Number(Number(rgba[4]).toFixed(ALPHA_DIGITS))})`
  return text
}
