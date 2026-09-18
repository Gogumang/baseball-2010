import { SpriteNumber } from '@/shared/ui'
import { glyphsWidthOf, numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import {
  LEVEL_DIGIT_OFFSET, LEVEL_LABEL_FRAME, LEVEL_LABEL_OFFSET, SLOT_ICON_FRAME, SLOT_SIZE,
} from '@/widgets/special-swing/lib/specialSwingLayout'
import * as styles from '@/shared/ui/GameWindow/GameWindow.css'
import * as local from '@/widgets/special-swing/ui/SpecialSwingWindow.css'

const IMG_TEXT = './sprites/img_text/frames'
const MODE_ICON = './sprites/mode_icon'
/** mode_icon.mpl 팔레트 0(주황)으로 다시 칠한 아이콘 — tools/generate_management_sprites.py 가 만든다 */
const ICON_ORANGE = `./sprites/management/icon_selected_${SLOT_ICON_FRAME}.png`
const ICON_NORMAL = `${MODE_ICON}/${String(SLOT_ICON_FRAME).padStart(3, '0')}.png`
/** img_text 294 "LV" 크기 */
const LEVEL_LABEL_SIZE = { width: 11, height: 5 }
const DIGIT_HEIGHT = 10

interface SpecialSwingSlotProps {
  readonly index: number
  readonly x: number
  readonly y: number
  /** 지금 필살 레벨의 칸이면 주황 아이콘 */
  readonly isCurrentLevel: boolean
  /** 해금되지 않은 칸은 안쪽 1px 을 흑백으로 (0xc37a8) */
  readonly isLocked: boolean
}

/** 필살 칸 하나 — 아이콘 · "LV" · 레벨 숫자 (0x805a8~0x807be) */
export function SpecialSwingSlot({ index, x, y, isCurrentLevel, isLocked }: SpecialSwingSlotProps) {
  const icon = isCurrentLevel ? ICON_ORANGE : ICON_NORMAL

  return (
    <>
      <SlotArt index={index} x={x} y={y} icon={icon} />
      {/* 흑백은 그림을 다 그린 뒤 칸 안쪽만 덮는다 — LV 글자와 숫자도 함께 회색이 된다 */}
      {isLocked && (
        <div className={local.lockedRegion}
          style={{ left: x + 1, top: y + 1, width: SLOT_SIZE.width - 2, height: SLOT_SIZE.height - 2 }}>
          <SlotArt index={index} x={-1} y={-1} icon={icon} />
        </div>
      )}
    </>
  )
}

/** 칸 그림 세 장. x·y 는 칸 왼쪽 위 — 흑백 덮개 안에서는 잘라낼 만큼 음수로 넣는다 */
function SlotArt({ index, x, y, icon }: { readonly index: number; readonly x: number; readonly y: number; readonly icon: string }) {
  const level = index + 1
  const digits = numberGlyphsOf(level)
  const digitRight = x + SLOT_SIZE.width + (index === 0 ? LEVEL_DIGIT_OFFSET.firstSlotX : LEVEL_DIGIT_OFFSET.x)

  return (
    <>
      <img className={styles.layer} alt="" src={icon} style={{ left: x, top: y }} />
      <img className={styles.layer} alt="" src={`${IMG_TEXT}/${LEVEL_LABEL_FRAME}.png`}
        style={{
          left: x + SLOT_SIZE.width - LEVEL_LABEL_SIZE.width + LEVEL_LABEL_OFFSET.x,
          top: y + SLOT_SIZE.height - LEVEL_LABEL_SIZE.height + LEVEL_LABEL_OFFSET.y,
        }} />
      {/* SpriteNumber 는 글자 폭에 뒤 1px 을 포함하므로 오른쪽 끝을 그만큼 넘겨 준다 */}
      <SpriteNumber glyphs={digits} right={digitRight + (glyphsWidthOf(digits) - digits[0].width)}
        boxTop={y + SLOT_SIZE.height - DIGIT_HEIGHT + LEVEL_DIGIT_OFFSET.y} boxHeight={DIGIT_HEIGHT} />
    </>
  )
}
