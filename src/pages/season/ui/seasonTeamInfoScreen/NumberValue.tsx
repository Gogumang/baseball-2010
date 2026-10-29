import { SpriteNumber } from '@/shared/ui'
import { glyphsWidthOf, numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import { managementStyles as styles } from './otherSlices'
import { VALUE_IMAGE_PALETTE, frameSrc, type PaletteStyleOf } from './infoAssets'

/** num 그림 0 (프레임 20) 의 폭 — 0x7c8fe `[[num]+0x50]` vt+0x1c (`pixelNumber` 의 0 폭) */
const NUM_ZERO_WIDTH = 6

/** 0x6c805(v, 10) — 10 으로 나눈 몫이 0 이 아닌 동안 센 수 (자릿수 − 1, 0~9 는 0) */
function nonZeroQuotientsOf(value: number): number {
  let count = 0
  for (let rest = Math.trunc(value / 10); rest !== 0; rest = Math.trunc(rest / 10)) count += 1
  return count
}

/**
 * **숫자 값 칸** — 좌석(0x7c8c2~0x7c944) · 우승(0x7cdaa~0x7cdc4) · 순위(0x7ce88~0x7ceae) 모두
 * `0xba719(박스 xy, 박스 wh, 자간 1, 값, 기준 0x14, [gfx+0x13c] = ui/num, 정렬 0x22)` → numBox 0xba51c:
 * 주황 숫자 그림(num 20 + 숫자)을 칸 가운데 — 가로 (w − Σ(폭 + 1)) >> 1 · 세로 ceil((h − 10) / 2). 시스템 글꼴이 아니다.
 * 좌석 꼬리 img_text 345 "석"(팔레트 1)은 0xb9e05(…, 정렬 0x22, dx = r >> 1) — r = (0x6c805(값, 10) + 2) × (num 20 폭 + 2)
 * (0x7c8f2~0x7c930), 0xb9d74 가 x = 칸 x + dx + (w − 그림 폭) >> 1 · 세로 가운데로 놓는다.
 */
export function NumberValue({
  value,
  suffixFrame,
  box,
  styleOf,
  sizeOf,
}: {
  readonly value: number
  readonly suffixFrame?: number
  readonly box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  readonly styleOf: PaletteStyleOf
  readonly sizeOf: (frame: number) => { readonly width: number; readonly height: number } | undefined
}) {
  const glyphs = numberGlyphsOf(value)
  const total = glyphsWidthOf(glyphs)
  const right = box.x + ((box.width - total) >> 1) + total
  // 크기 표가 아직 없으면(첫 틀 · 시험) 0 으로 셈한다 — 표가 오면 다시 그린다
  const suffixSize = suffixFrame === undefined ? undefined : (sizeOf(suffixFrame) ?? { width: 0, height: 0 })
  const suffixDx = ((nonZeroQuotientsOf(value) + 2) * (NUM_ZERO_WIDTH + 2)) >> 1
  return (
    <>
      <SpriteNumber glyphs={glyphs} right={right} boxTop={box.y} boxHeight={box.height} />
      {suffixFrame !== undefined && suffixSize !== undefined && (
        <img
          className={styles.layer}
          alt=""
          data-frame={suffixFrame}
          src={frameSrc(suffixFrame)}
          style={{
            left: box.x + suffixDx + ((box.width - suffixSize.width) >> 1),
            top: box.y + Math.trunc((box.height - suffixSize.height + 1) / 2),
            ...styleOf(suffixFrame, VALUE_IMAGE_PALETTE),
          }}
        />
      )}
    </>
  )
}
