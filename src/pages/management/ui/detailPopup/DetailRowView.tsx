import { SpriteNumber } from '@/shared/ui'
import { glyphsWidthOf, numberGlyphsOf } from '@/pages/management/lib/managementLayout'
import {
  CHANGE_ARROW_FRAMES,
  DETAIL_CHANGE_X,
  DETAIL_CURRENT_DX,
  DETAIL_LABEL_BOX,
  DETAIL_MAXIMUM_DX,
  DETAIL_SLASH_FRAME,
  type DetailRow,
} from '@/pages/management/lib/detailPopup'
import * as styles from '@/pages/management/ui/DetailPopup.css'
import {
  BONUS_NUMBER_DX,
  BONUS_SIGN_DX,
  BONUS_SIGN_FRAMES,
  BONUS_SIGN_HEIGHTS,
  CHANGE_LEFT,
  IMG_TEXT,
  MODE_UI,
  NUM,
  ROW_HEIGHT,
  imageOf,
} from './detailAssets'

/** 가운데 맞춘 숫자 — 0x872d4 의 현재 · 최대 칸 */
function CenteredNumber({ value, center, top }: { readonly value: number; readonly center: number; readonly top: number }) {
  const glyphs = numberGlyphsOf(value)
  return <SpriteNumber glyphs={glyphs} right={center + Math.ceil(glyphsWidthOf(glyphs) / 2)} boxTop={top} boxHeight={ROW_HEIGHT} />
}

/** 왼쪽에서 dx 민 자리부터 |값| — 변화량 · 보너스 숫자 */
function LeftNumber({ value, left, top }: { readonly value: number; readonly left: number; readonly top: number }) {
  return (
    <SpriteNumber
      glyphs={numberGlyphsOf(Math.abs(value))}
      right={left + glyphsWidthOf(numberGlyphsOf(Math.abs(value)))}
      boxTop={top}
      boxHeight={ROW_HEIGHT}
    />
  )
}

/** 넷째 칸 — 부호(num 105 "+" / 128 "−")와 |값| (0x875bc~0x8761e) */
function BonusCells({ bonus, top }: { readonly bonus: number; readonly top: number }) {
  const isPlus = bonus > 0
  const signHeight = isPlus ? BONUS_SIGN_HEIGHTS.plus : BONUS_SIGN_HEIGHTS.minus
  return (
    <>
      <img
        className={styles.layer}
        alt=""
        src={imageOf(NUM, isPlus ? BONUS_SIGN_FRAMES.plus : BONUS_SIGN_FRAMES.minus)}
        style={{ left: CHANGE_LEFT + BONUS_SIGN_DX, top: top + Math.trunc((ROW_HEIGHT - signHeight) / 2) }}
      />
      <LeftNumber value={bonus} left={CHANGE_LEFT + BONUS_NUMBER_DX} top={top} />
    </>
  )
}

/** 변화량 칸 — ▲/▼(3갱신마다 1px 흔들림) · |값| (dx +4 — 기준(정렬)은 미확인이라 화살표 오른쪽에 둔다, 추정) */
function ChangeCells({ row, top, sway }: { readonly row: DetailRow; readonly top: number; readonly sway: number }) {
  const isUp = row.change > 0
  return (
    <>
      <img
        className={styles.layer}
        alt=""
        src={imageOf(MODE_UI, isUp ? CHANGE_ARROW_FRAMES.up : CHANGE_ARROW_FRAMES.down)}
        style={{ left: DETAIL_CHANGE_X, top: top + 2 - (isUp ? sway : -sway) }}
      />
      <LeftNumber value={row.change} left={CHANGE_LEFT} top={top} />
      {/* 넷째 칸 — 변화량이 0 이 아닐 때만 본다 (0x87548 이 변화량 0 이면 줄 끝으로 건너뛴다) */}
      {row.bonus !== 0 && <BonusCells bonus={row.bonus} top={top} />}
    </>
  )
}

interface DetailRowViewProps {
  readonly row: DetailRow
  readonly top: number
  readonly valueCenter: number
  readonly sway: number
  readonly widthOf: (frame: number) => number
}

/** 한 줄 — 이름표(오른쪽 맞춤) · 현재 / 최대 · 변화량 */
export function DetailRowView({ row, top, valueCenter, sway, widthOf }: DetailRowViewProps) {
  return (
    <div>
      <img
        className={styles.layer}
        alt=""
        src={imageOf(IMG_TEXT, row.labelFrame)}
        style={{ left: DETAIL_LABEL_BOX.x + DETAIL_LABEL_BOX.width - widthOf(row.labelFrame), top: top + 3 }}
      />
      <CenteredNumber value={row.current} center={valueCenter + DETAIL_CURRENT_DX} top={top} />
      <img
        className={styles.layer}
        alt=""
        src={imageOf(IMG_TEXT, DETAIL_SLASH_FRAME)}
        style={{ left: valueCenter - Math.trunc(widthOf(DETAIL_SLASH_FRAME) / 2), top: top + 3 }}
      />
      <CenteredNumber value={row.maximum} center={valueCenter + DETAIL_MAXIMUM_DX} top={top} />
      {row.change !== 0 && <ChangeCells row={row} top={top} sway={sway} />}
    </div>
  )
}
