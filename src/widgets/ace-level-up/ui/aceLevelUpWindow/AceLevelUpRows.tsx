import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { FrameSprite } from '@/shared/ui'
import type { aceLevelUpRowsOf } from '@/entities/mission/model/aceLevel'
import {
  ACE_LEVEL_UP_ARROW_IMAGE,
  ACE_LEVEL_UP_BAR_FRAME,
  ACE_LEVEL_UP_HEAD,
  ACE_LEVEL_UP_TIMES_FRAME,
  aceLevelUpNumberOf,
  aceLevelUpRowOf,
} from '@/widgets/ace-level-up/lib/aceLevelUpLayout'
import * as styles from '@/widgets/ace-level-up/ui/AceLevelUpWindow.css'
import { ImgTextLine, NumberGlyphImages } from '@/widgets/ace-level-up/ui/aceLevelUpWindow/AceLevelUpGlyphs'
import { SLT_FRAME, SLT_IMAGE, pad } from '@/widgets/ace-level-up/ui/aceLevelUpWindow/aceLevelUpAssets'

/** 머리 줄 — LV 지금 → 다음 */
export function AceLevelUpHead({
  level,
  sltOrigins,
  widthOf,
}: {
  readonly level: number
  readonly sltOrigins: FrameOrigins | null
  readonly widthOf: (frame: number) => number
}) {
  const head = ACE_LEVEL_UP_HEAD
  return (
    <>
      <FrameSprite folder={SLT_FRAME} frame={ACE_LEVEL_UP_BAR_FRAME} origins={sltOrigins} x={head.bar.x} y={head.bar.y} />
      <img
        className={styles.layer}
        alt=""
        src={`${SLT_IMAGE}/${pad(ACE_LEVEL_UP_ARROW_IMAGE)}.png`}
        style={{ left: head.arrow.x, top: head.arrow.y }}
      />
      <ImgTextLine frame={head.labelFrame} left={head.labelRight - widthOf(head.labelFrame)} top={head.labelY} />
      <span data-testid="레벨업-레벨" aria-label={`LV ${level + 1} → ${level + 2}`}>
        <NumberGlyphImages glyphs={aceLevelUpNumberOf(level + 1, head.currentCenterX, head.numberY, 2)} keyPrefix="lv-now" />
        <NumberGlyphImages glyphs={aceLevelUpNumberOf(level + 2, head.nextCenterX, head.numberY, 2)} keyPrefix="lv-next" />
      </span>
    </>
  )
}

/** 다섯 줄 — 능력치 네 칸의 지금 값 → 다음 레벨 값 + 필살타법/마구 횟수 (칸 · 화살 · 칸 · 이름 · "회" · 숫자 둘) */
export function AceLevelUpRow({
  row,
  index,
  labelFrame,
  sltOrigins,
  widthOf,
}: {
  readonly row: ReturnType<typeof aceLevelUpRowsOf>[number]
  readonly index: number
  readonly labelFrame: number
  readonly sltOrigins: FrameOrigins | null
  readonly widthOf: (frame: number) => number
}) {
  const place = aceLevelUpRowOf(index)
  return (
    <div data-testid="레벨업-줄" aria-label={`${row.label} ${row.current} → ${row.next}`}>
      <FrameSprite folder={SLT_FRAME} frame={ACE_LEVEL_UP_BAR_FRAME} origins={sltOrigins} x={place.currentBar.x} y={place.currentBar.y} />
      <img
        className={styles.layer}
        alt=""
        src={`${SLT_IMAGE}/${pad(ACE_LEVEL_UP_ARROW_IMAGE)}.png`}
        style={{ left: place.arrow.x, top: place.arrow.y }}
      />
      <FrameSprite folder={SLT_FRAME} frame={ACE_LEVEL_UP_BAR_FRAME} origins={sltOrigins} x={place.nextBar.x} y={place.nextBar.y} />
      <ImgTextLine frame={labelFrame} left={place.labelRight - widthOf(labelFrame)} top={place.labelY} />
      {place.times.map((spot, spotIndex) => (
        <ImgTextLine key={`times-${spotIndex}`} frame={ACE_LEVEL_UP_TIMES_FRAME} left={spot.x} top={spot.y} />
      ))}
      <NumberGlyphImages glyphs={aceLevelUpNumberOf(row.current, place.currentRight, place.numberY, 4)} keyPrefix="now" />
      <NumberGlyphImages glyphs={aceLevelUpNumberOf(row.next, place.nextRight, place.numberY, 4)} keyPrefix="next" />
    </div>
  )
}
