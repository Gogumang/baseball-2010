import { useEffect, useState } from 'react'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { SpriteNumber } from '@/shared/ui'
import { glyphsWidthOf, numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { BATTER_BURSTS } from '@/shared/config/original/bursts'
import {
  COUNT_BOX, COUNT_DIGIT_OFFSET_X, COUNT_LABEL_FRAME, COUNT_LABEL_OFFSET_X, CURSOR_BLINK_PERIOD,
  CURSOR_VISIBLE_UPDATES, DESCRIPTION_BOX, FRAME_IMAGE, NAME_BOX, SLOT_COUNT, SLOT_SIZE, SLOT_XS, SLOT_Y,
  SPECIAL_SWING_WINDOW, TITLE_BOX, TITLE_FRAME, unlockedSlotCountOf,
} from '@/widgets/special-swing/lib/specialSwingLayout'
import { SpecialSwingSlot } from '@/widgets/special-swing/ui/SpecialSwingSlot'
import * as styles from '@/shared/ui/GameWindow/GameWindow.css'
import * as local from '@/widgets/special-swing/ui/SpecialSwingWindow.css'

const IMG_TEXT = './sprites/img_text/frames'
const MODE_UI = './sprites/mode_ui/frames'
/** img_text 글자 그림 높이 */
const LABEL_HEIGHT = 10

interface SpecialSwingWindowProps {
  /** 지금 필살 레벨 (0~4). 칸 번호+1 이 이 값이면 아이콘이 주황이다 */
  readonly level: number
  /** 이번 레벨에서 지금까지 한 훈련 횟수 */
  readonly sessions: number
  readonly onClose: () => void
}

/** 필살타법 창 (0x803d4) — 칸 4개 · 이름 · 설명 · 훈련 횟수. 나만의리그 장면 위에 뜬다 */
export function SpecialSwingWindow({ level, sessions, onClose }: SpecialSwingWindowProps) {
  const [cursor, setCursor] = useState(Math.min(Math.max(level - 1, 0), SLOT_COUNT - 1))
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const update = useUpdateCounter()
  const isCursorVisible = update % CURSOR_BLINK_PERIOD < CURSOR_VISIBLE_UPDATES
  const unlockedCount = unlockedSlotCountOf(level)
  const widthOf = (frame: number) => textOrigins?.[String(frame).padStart(3, '0')]?.width ?? 0
  const countGlyphs = numberGlyphsOf(sessions)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (step !== 0) setCursor((current) => (current + step + SLOT_COUNT) % SLOT_COUNT)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className={styles.overlay} role="dialog" aria-label="필살타법" onClick={onClose}>
      <div className={styles.window}
        style={{ left: SPECIAL_SWING_WINDOW.x, top: SPECIAL_SWING_WINDOW.y, width: SPECIAL_SWING_WINDOW.width, height: SPECIAL_SWING_WINDOW.height }} />
      <img className={styles.layer} alt="" src={`./sprites/management/label_navy_${TITLE_FRAME}.png`}
        style={{ left: TITLE_BOX.x + Math.trunc((TITLE_BOX.width - widthOf(TITLE_FRAME)) / 2), top: TITLE_BOX.y + Math.trunc((TITLE_BOX.height - LABEL_HEIGHT + 1) / 2) }} />
      <img className={styles.layer} alt="" src={`${MODE_UI}/${String(FRAME_IMAGE.frame).padStart(3, '0')}.png`}
        style={{ left: FRAME_IMAGE.x, top: FRAME_IMAGE.y }} />

      {SLOT_XS.map((x, index) => (
        <button key={x} type="button" aria-label={`필살 LV${index + 1}`} className={local.slotButton}
          style={{ left: x, top: SLOT_Y, width: SLOT_SIZE.width, height: SLOT_SIZE.height }}
          onMouseEnter={() => setCursor(index)}
          onClick={(event) => { event.stopPropagation(); setCursor(index) }} />
      ))}
      {SLOT_XS.map((x, index) => (
        <SpecialSwingSlot key={x} index={index} x={x} y={SLOT_Y}
          isCurrentLevel={index + 1 === level} isLocked={unlockedCount <= index} />
      ))}
      {isCursorVisible && (
        <svg className={styles.layer} viewBox="0 0 240 320" width={240} height={320} shapeRendering="crispEdges">
          {/* 테두리는 칸을 1px 씩 둘러싼 (폭+2)×(높이+2) 상자다 — 선을 픽셀 칸 가운데에 두려고 반 칸 옮긴다 */}
          <rect x={SLOT_XS[cursor] - 0.5} y={SLOT_Y - 0.5} width={SLOT_SIZE.width + 1} height={SLOT_SIZE.height + 1}
            fill="none" stroke={ORIGINAL_COLORS.text} strokeWidth={1} />
        </svg>
      )}

      <div className={local.text} style={{ left: NAME_BOX.x, top: NAME_BOX.y + 1, width: NAME_BOX.width }}>
        {BATTER_BURSTS[cursor] ?? ''}
      </div>
      {/* 설명 문자열은 원본 문자열표 번호 계산(293/295)이 미해독이라 비워 둔다 */}
      <div className={local.text} style={{ left: DESCRIPTION_BOX.x, top: DESCRIPTION_BOX.y, width: DESCRIPTION_BOX.width }} />

      <SpriteNumber glyphs={countGlyphs}
        right={COUNT_BOX.x + Math.trunc((COUNT_BOX.width - glyphsWidthOf(countGlyphs)) / 2) + COUNT_DIGIT_OFFSET_X + glyphsWidthOf(countGlyphs)}
        boxTop={COUNT_BOX.y} boxHeight={COUNT_BOX.height} />
      <img className={styles.layer} alt="" src={`${IMG_TEXT}/${COUNT_LABEL_FRAME}.png`}
        style={{
          left: COUNT_BOX.x + Math.trunc((COUNT_BOX.width - widthOf(COUNT_LABEL_FRAME)) / 2) + COUNT_LABEL_OFFSET_X,
          top: COUNT_BOX.y + Math.trunc((COUNT_BOX.height - LABEL_HEIGHT + 1) / 2),
        }} />
    </div>
  )
}

