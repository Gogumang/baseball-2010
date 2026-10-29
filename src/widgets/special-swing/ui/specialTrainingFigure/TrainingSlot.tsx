import { PaintedRects } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { PanelPaint } from '@/shared/lib/commonPanel/commonPanel'
import type { TrainingBox } from '@/widgets/special-swing/lib/specialTrainingWindow'
import { DRAW_EFFECT, css565, grayPixel565 } from '@/shared/lib/pixelEffect/pixelEffect'
import { useEffectSpriteUrl } from '@/shared/lib/pixelEffect/useEffectSpriteUrl'
import { rgbTo565 } from '@/shared/lib/screen565/screen565'
import {
  LEVEL_LABEL_FRAME,
  LEVEL_LABEL_OFFSET,
  SPECIAL_TRAINING_INNER_COLORS,
  SPECIAL_TRAINING_SLOT_BOXES,
  isSlotIconInUse,
  isSlotLocked,
  levelDigitOffsetOf,
  lockRegionOf,
} from '@/widgets/special-swing/lib/specialTrainingWindow'
import {
  ICON_ORANGE,
  IMG_TEXT,
  MODE_ICON,
  NUM,
  WHITE_DIGIT_HEIGHT,
  frameAt,
  imageAt,
  pad3,
  whiteDigitWidthOf,
} from '@/widgets/special-swing/ui/specialTrainingFigure/figureAssets'

/** 그림 한 장 — `gray` 면 0xc37a8 회색 식(`grayPixel565`)으로 칠한 주소를 쓰고, 칠하는 동안은 안 그린다 */
function SlotImage({ src, left, top, gray }: { readonly src: string; readonly left: number; readonly top: number; readonly gray: boolean }) {
  const grayed = useEffectSpriteUrl(gray ? src : null, DRAW_EFFECT.GRAY, 0)
  const shown = gray ? grayed : src
  if (shown === null) return null
  return <img alt="" src={shown} style={{ position: 'absolute', left, top, pointerEvents: 'none' }} />
}

/** 칸 그림 셋 — 아이콘 · "LV" · 칸 번호 (0x80620~0x80724). `gray` 는 0xc37a8 흑백 칸에 다시 그릴 때 */
function SlotArt({
  slot,
  dx,
  dy,
  iconFrame,
  inUseNumber,
  textOrigins,
  gray,
}: {
  readonly slot: number
  readonly dx: number
  readonly dy: number
  readonly iconFrame: number
  readonly inUseNumber: number
  readonly textOrigins: FrameOrigins | null
  readonly gray: boolean
}) {
  const box = SPECIAL_TRAINING_SLOT_BOXES[slot]
  const shifted = { ...box, x: box.x + dx, y: box.y + dy }
  const icon = isSlotIconInUse(slot, inUseNumber) ? `${ICON_ORANGE}${iconFrame}.png` : `${MODE_ICON}/${pad3(iconFrame)}.png`
  const lvAt = frameAt(textOrigins, LEVEL_LABEL_FRAME, shifted, 0x44, LEVEL_LABEL_OFFSET.x, LEVEL_LABEL_OFFSET.y)
  const lvOrigin = textOrigins?.[pad3(LEVEL_LABEL_FRAME)]
  const digit = slot + 1
  const digitOffset = levelDigitOffsetOf(slot)
  const digitAt = imageAt(shifted, whiteDigitWidthOf(digit), WHITE_DIGIT_HEIGHT, 0x44, digitOffset.x, digitOffset.y)
  // 아이콘 33×33 을 칸(33×34)에 정렬 0x22 — 세로 trunc(1/2) = 0 이라 왼쪽 위 그대로
  return (
    <>
      <SlotImage src={icon} left={shifted.x} top={shifted.y} gray={gray} />
      {lvAt !== null && lvOrigin !== undefined && (
        <SlotImage src={`${IMG_TEXT}/${pad3(LEVEL_LABEL_FRAME)}.png`} left={lvAt.x + lvOrigin.x} top={lvAt.y + lvOrigin.y} gray={gray} />
      )}
      <SlotImage src={`${NUM}/${pad3(digit)}.png`} left={digitAt.left} top={digitAt.top} gray={gray} />
    </>
  )
}

/**
 * 0xc37a8 흑백 칸의 바탕 — 안쪽 칠(565)을 회색 식으로 바꾼 색.
 * 칸 그림은 알파가 0 · 255 뿐이라 겹친 뒤 회색으로 바꾸는 것과 장마다 회색으로 바꿔 겹치는 것이 같다.
 */
const GRAY_INNER_FILL = (() => {
  const value = Number.parseInt(SPECIAL_TRAINING_INNER_COLORS.fill.slice(1), 16)
  return css565(grayPixel565(rgbTo565((value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff)))
})()

interface TrainingSlotProps {
  readonly slot: number
  readonly iconFrame: number
  readonly inUseNumber: number
  readonly learnedCount: number
  readonly textOrigins: FrameOrigins | null
  /** 이 그림에 커서가 서 있다(깜박임 켜진 틀) */
  readonly isCursorDrawn: boolean
  readonly cursorBox: TrainingBox
  readonly cursorPaints: readonly PanelPaint[]
}

/** 칸 하나 — 칸 그림 · 커서 · 잠긴 칸 흑백 */
export function TrainingSlot({ slot, iconFrame, inUseNumber, learnedCount, textOrigins, isCursorDrawn, cursorBox, cursorPaints }: TrainingSlotProps) {
  const isLocked = isSlotLocked(slot, learnedCount)
  const region = lockRegionOf(slot, isCursorDrawn)
  const art = { slot, iconFrame, inUseNumber, textOrigins }
  return (
    <div data-testid={`필살칸-${slot}`} data-locked={isLocked} data-in-use={isSlotIconInUse(slot, inUseNumber)}>
      <SlotArt {...art} dx={0} dy={0} gray={false} />
      {isCursorDrawn && (
        <PaintedRects
          x={cursorBox.x}
          y={cursorBox.y}
          width={cursorBox.width + 1}
          height={cursorBox.height + 1}
          paints={cursorPaints}
          testId="필살칸-커서"
        />
      )}
      {/* 0xc37a9 흑백 — 화면에 이미 그린 자리를 바꾼다. 같은 자리(안쪽 칠 + 칸 그림)를 원본 회색 식으로 칠해 다시 그린다 */}
      {isLocked && (
        <div
          data-testid={`필살칸-흑백-${slot}`}
          style={{
            position: 'absolute',
            left: region.x,
            top: region.y,
            width: region.width,
            height: region.height,
            overflow: 'hidden',
            pointerEvents: 'none',
            background: GRAY_INNER_FILL,
          }}
        >
          <SlotArt {...art} dx={-region.x} dy={-region.y} gray />
        </div>
      )}
    </div>
  )
}
