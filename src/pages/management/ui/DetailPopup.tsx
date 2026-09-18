import { FrameSprite, SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { glyphsWidthOf, numberGlyphsOf } from '@/pages/management/lib/managementLayout'
import {
  CHANGE_ARROW_FRAMES, DETAIL_CHANGE_X, DETAIL_CURRENT_DX, DETAIL_HEADER, DETAIL_LABEL_BOX, DETAIL_MAXIMUM_DX,
  DETAIL_MESSAGE_BOX, DETAIL_MESSAGE_LINE_HEIGHT, DETAIL_ROW_TOP, DETAIL_SLASH_FRAME, DETAIL_TABLE_FRAME,
  DETAIL_TITLE_FRAME, DETAIL_VALUE_BOX, DETAIL_WINDOW, DETAIL_Y_OFFSET, detailRowsOf,
} from '@/pages/management/lib/detailPopup'
import type { DetailResult } from '@/pages/management/lib/detailPopup'
import * as styles from '@/pages/management/ui/DetailPopup.css'

const IMG_TEXT = '/sprites/img_text/frames'
const MODE_UI = '/sprites/mode_ui/frames'
const imageOf = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`
const ROW_HEIGHT = 15
/** 화살표는 3갱신마다 1px 흔들린다 */
const ARROW_SWAY_UPDATES = 3

interface DetailPopupProps {
  readonly result: DetailResult
  readonly onClose: () => void
}

/** 상세정보 창 — 표와 메시지 줄. 누르면 닫힌다. 창 모양(0x55e60)은 선 목록만 확인돼 CSS 로 근사한다 (추정) */
export function DetailPopup({ result, onClose }: DetailPopupProps) {
  const origins = useFrameOrigins(MODE_UI)
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const sway = Math.floor(useUpdateCounter() / ARROW_SWAY_UPDATES) % 2
  const widthOf = (frame: number) => textOrigins?.[String(frame).padStart(3, '0')]?.width ?? 0
  const valueCenter = DETAIL_VALUE_BOX.x + Math.trunc(DETAIL_VALUE_BOX.width / 2)
  const centered = (value: number, center: number, top: number) => {
    const glyphs = numberGlyphsOf(value)
    return <SpriteNumber glyphs={glyphs} right={center + Math.ceil(glyphsWidthOf(glyphs) / 2)} boxTop={top} boxHeight={ROW_HEIGHT} />
  }

  return (
    <div className={styles.overlay} role="dialog" aria-label="상세정보" onClick={onClose}>
      <div className={styles.window} style={{ left: DETAIL_WINDOW.x, top: DETAIL_WINDOW.y, width: DETAIL_WINDOW.width, height: DETAIL_WINDOW.height }} />
      <img className={styles.layer} alt="" src={`/sprites/management/label_navy_${DETAIL_TITLE_FRAME}.png`}
        style={{ left: DETAIL_WINDOW.x + Math.trunc((85 - widthOf(DETAIL_TITLE_FRAME)) / 2), top: DETAIL_WINDOW.y + 5 }} />
      <FrameSprite folder={MODE_UI} frame={DETAIL_TABLE_FRAME} origins={origins} x={0} y={DETAIL_Y_OFFSET} />
      <img className={styles.layer} alt="" src={imageOf(IMG_TEXT, DETAIL_HEADER.frame)}
        style={{ left: valueCenter - Math.trunc(widthOf(DETAIL_HEADER.frame) / 2), top: DETAIL_HEADER.box.y + 3 }} />
      {detailRowsOf(result.before, result.after).map((row, index) => {
        const top = DETAIL_ROW_TOP(index)
        return (
          <div key={row.labelFrame}>
            <img className={styles.layer} alt="" src={imageOf(IMG_TEXT, row.labelFrame)}
              style={{ left: DETAIL_LABEL_BOX.x + DETAIL_LABEL_BOX.width - widthOf(row.labelFrame), top: top + 3 }} />
            {centered(row.current, valueCenter + DETAIL_CURRENT_DX, top)}
            <img className={styles.layer} alt="" src={imageOf(IMG_TEXT, DETAIL_SLASH_FRAME)}
              style={{ left: valueCenter - Math.trunc(widthOf(DETAIL_SLASH_FRAME) / 2), top: top + 3 }} />
            {centered(row.maximum, valueCenter + DETAIL_MAXIMUM_DX, top)}
            {row.change !== 0 && (
              <>
                <img className={styles.layer} alt=""
                  src={imageOf(MODE_UI, row.change > 0 ? CHANGE_ARROW_FRAMES.up : CHANGE_ARROW_FRAMES.down)}
                  style={{ left: DETAIL_CHANGE_X, top: top + 2 - (row.change > 0 ? sway : -sway) }} />
                {/* |값| 을 dx +4 — 기준(정렬)은 미확인이라 화살표 오른쪽에 둔다 (추정) */}
                <SpriteNumber glyphs={numberGlyphsOf(Math.abs(row.change))} right={DETAIL_CHANGE_X + 15 + glyphsWidthOf(numberGlyphsOf(Math.abs(row.change)))} boxTop={top} boxHeight={ROW_HEIGHT} />
              </>
            )}
          </div>
        )
      })}
      <div className={styles.messages} style={{ left: DETAIL_MESSAGE_BOX.x, top: DETAIL_MESSAGE_BOX.y, width: DETAIL_MESSAGE_BOX.width, height: DETAIL_MESSAGE_BOX.height }}>
        {result.messages.map((message, index) => (
          <div key={index} style={{ height: DETAIL_MESSAGE_LINE_HEIGHT }}>{message}</div>
        ))}
      </div>
    </div>
  )
}
