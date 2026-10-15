import { useMemo } from 'react'
import { CommonPanel, FrameSprite, PaintedRects, PressArea, SolidStamp, SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import { roundEdgePaintsOf } from '@/shared/lib/commonPanel/commonPanel'
import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { DRAW_EFFECT, css565, grayPixel565 } from '@/shared/lib/pixelEffect/pixelEffect'
import { useEffectSpriteUrl } from '@/shared/lib/pixelEffect/useEffectSpriteUrl'
import { rgbTo565 } from '@/shared/lib/screen565/screen565'
import {
  LEVEL_LABEL_FRAME, LEVEL_LABEL_OFFSET, SPECIAL_TRAINING_COST_BOX, SPECIAL_TRAINING_COUNT_BOX, SPECIAL_TRAINING_CURSOR_COLOR,
  SPECIAL_TRAINING_DESCRIPTION_BOX, SPECIAL_TRAINING_INNER, SPECIAL_TRAINING_INNER_COLORS,
  SPECIAL_TRAINING_LAYOUT_FRAME, SPECIAL_TRAINING_NAME_BOX, SPECIAL_TRAINING_NAME_COLOR, SPECIAL_TRAINING_PANEL,
  SPECIAL_TRAINING_SLASH_IMAGE, SPECIAL_TRAINING_SLOT_BOXES, SPECIAL_TRAINING_STATUS_BOX, SPECIAL_TRAINING_TIMES_LABEL,
  SPECIAL_TRAINING_TITLE_BOX, SPECIAL_TRAINING_TITLE_COLOR, SPECIAL_TRAINING_TITLE_OX, cursorBoxOf, isSlotIconInUse,
  isSlotInUse, isSlotLocked, isSpecialTrainingBlinkOn, levelDigitOffsetOf, lockRegionOf, slotCostOf, slotDescriptionOf,
  slotNameOf, slotProgressOf, specialTrainingIconFrameOf, specialTrainingTitleFrameOf, statusLabelOf,
} from '@/widgets/special-swing/lib/specialTrainingWindow'
import type { SpecialTrainingSide, SpecialTrainingState, TrainingBox } from '@/widgets/special-swing/lib/specialTrainingWindow'

const MODE_UI = './sprites/mode_ui/frames'
const IMG_TEXT = './sprites/img_text/frames'
const MODE_ICON = './sprites/mode_icon'
/** mode_icon.mpl 팔레트 0(주황)으로 다시 칠한 아이콘 — tools/generate_management_sprites.py 가 만든다 */
const ICON_ORANGE = './sprites/management/icon_selected_'
/** num 흰 숫자 0~9 (8×10, "1" 만 4×10) · "/" 101 (10×10) */
const NUM = './sprites/num'
const WHITE_DIGIT_HEIGHT = 10
const SLASH_SIZE = 10
const whiteDigitWidthOf = (digit: number) => (digit === 1 ? 4 : 8)
/** G 동전 gpoint 11 (18×18) — 박스 3 에 정렬 0x21 · ox 2 */
const G_COIN = { src: './sprites/gpoint/011.png', x: SPECIAL_TRAINING_COST_BOX.x + 2, y: SPECIAL_TRAINING_COST_BOX.y } as const
const SCREEN = { width: 240, height: 320 } as const
const pad3 = (frame: number) => String(frame).padStart(3, '0')
const layer = { position: 'absolute', left: 0, top: 0, pointerEvents: 'none' } as const

/** 0xb9e05 → 0xb9d74 프레임 맞춤: 0x2 가로 가운데(내림) · 0x4 오른쪽 · 0x20 세로 가운데(올림) · 0x40 아래 — 원점은 FrameSprite 가 더한다 */
function frameAt(origins: FrameOrigins | null, frame: number, box: TrainingBox, align: number, ox = 0, oy = 0) {
  const origin = origins?.[pad3(frame)]
  if (origin === undefined) return null
  let x = box.x + ox
  let y = box.y + oy
  if ((align & 0x2) !== 0) x += (box.width - origin.width) >> 1
  if ((align & 0x4) !== 0) x += box.width - origin.width
  if ((align & 0x20) !== 0) {
    const d = box.height - origin.height
    y += Math.trunc(d / 2) + (d % 2)
  }
  if ((align & 0x40) !== 0) y += box.height - origin.height
  return { x, y }
}

/** 0xb9d35 → 0xb9c5c 그림 맞춤: 0x22 가로 d → trunc(d/2) + d%2 · 세로 trunc((h − ih)/2), 0x44 오른쪽 아래 */
function imageAt(box: TrainingBox, width: number, height: number, align: 0x22 | 0x44, ox: number, oy = 0) {
  if (align === 0x44) return { left: box.x + box.width - width + ox, top: box.y + box.height - height + oy }
  const d = box.width - width
  return { left: box.x + Math.trunc(d / 2) + (d % 2) + ox, top: box.y + Math.trunc((box.height - height) / 2) + oy }
}

/** 그림 한 장 — `gray` 면 0xc37a8 회색 식(`grayPixel565`)으로 칠한 주소를 쓰고, 칠하는 동안은 안 그린다 */
function SlotImage({ src, left, top, gray }: { readonly src: string; readonly left: number; readonly top: number; readonly gray: boolean }) {
  const grayed = useEffectSpriteUrl(gray ? src : null, DRAW_EFFECT.GRAY, 0)
  const shown = gray ? grayed : src
  if (shown === null) return null
  return <img alt="" src={shown} style={{ position: 'absolute', left, top, pointerEvents: 'none' }} />
}

/** 칸 그림 셋 — 아이콘 · "LV" · 칸 번호 (0x80620~0x80724). `gray` 는 0xc37a8 흑백 칸에 다시 그릴 때 */
function SlotArt({ slot, dx, dy, iconFrame, inUseNumber, textOrigins, gray }: {
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

export interface SpecialTrainingFigureProps {
  readonly side: SpecialTrainingSide
  readonly state: SpecialTrainingState
  /** 탭 격자 [gfx+0x190] 칸 0~3 */
  readonly cursor: number
  /** 배운 수 L — s8 [저장+0x201] */
  readonly learnedCount: number
  /** 이번 레벨에 쌓은 횟수 — s8 [저장+0x200] */
  readonly sessions: number
  /** 레코드 +0x18 — 고른 번호 */
  readonly inUseNumber: number
  /** 레코드 +0xb 위 3비트 — 타자 타입 · 투수 등록 타입(= 폼/2) */
  readonly typeIndex: number
  /** 칸 누름 — 마우스 길(원본 칸 자리 투명 누름 칸) */
  readonly onPressSlot: (slot: number) => void
}

/**
 * **필살타법 · 마구 창 그림** — 0x803d4 탭 0 · 1 (배치 · 차례는 `lib/specialTrainingWindow` 머리글, 직접 떴다).
 * 타자 108 탭 0 · 123, 투수 108 탭 1 이 같은 그림을 쓴다.
 */
export function SpecialTrainingFigure({
  side, state, cursor, learnedCount, sessions, inUseNumber, typeIndex, onPressSlot,
}: SpecialTrainingFigureProps) {
  const uiOrigins = useFrameOrigins(MODE_UI)
  const textOrigins = useFrameOrigins(IMG_TEXT)
  // ⚠️ 상태 틱 [장면+0x2c] 의 첫 그림 값은 안 읽었다 — 창이 선 뒤의 갱신 수로 센다
  const tick = useUpdateCounter()
  const isBlinkOn = isSpecialTrainingBlinkOn(tick)
  const isTraining = state === '훈련'
  const inner = SPECIAL_TRAINING_INNER
  const iconFrame = specialTrainingIconFrameOf(side)
  const titleFrame = specialTrainingTitleFrameOf(side)
  const titleAt = frameAt(textOrigins, titleFrame, SPECIAL_TRAINING_TITLE_BOX, 0x21, SPECIAL_TRAINING_TITLE_OX)
  const label = statusLabelOf(state, cursor, learnedCount, isSlotInUse(cursor, inUseNumber, typeIndex))
  const labelAt = label === null ? null : frameAt(textOrigins, label, SPECIAL_TRAINING_STATUS_BOX, 0x22)
  const progress = slotProgressOf(cursor, learnedCount, sessions)
  const timesAt = frameAt(textOrigins, SPECIAL_TRAINING_TIMES_LABEL, SPECIAL_TRAINING_COUNT_BOX, 0x24, -3)
  const countAt = imageAt(SPECIAL_TRAINING_COUNT_BOX, whiteDigitWidthOf(progress.count), WHITE_DIGIT_HEIGHT, 0x22, -10)
  const slashAt = imageAt(SPECIAL_TRAINING_COUNT_BOX, SLASH_SIZE, SLASH_SIZE, 0x22, 0)
  const requiredAt = imageAt(SPECIAL_TRAINING_COUNT_BOX, whiteDigitWidthOf(progress.required), WHITE_DIGIT_HEIGHT, 0x22, 10)
  const cursorBox = cursorBoxOf(cursor)
  const cursorPaints = useMemo(
    () => roundEdgePaintsOf(cursorBox.width, cursorBox.height, SPECIAL_TRAINING_CURSOR_COLOR),
    [cursorBox.width, cursorBox.height],
  )
  const descriptionLines = parseGameMarkup(slotDescriptionOf(side, cursor, typeIndex))

  const slotArt = (slot: number, dx: number, dy: number, gray = false) => (
    <SlotArt slot={slot} dx={dx} dy={dy} iconFrame={iconFrame} inUseNumber={inUseNumber} textOrigins={textOrigins} gray={gray} />
  )

  return (
    <div data-testid="필살타법-그림" data-side={side} data-state={state}>
      {/* 8046c 공용 판 0x55e61(skin, 박스 0, 0, 정렬 0x11, 위 띠 0x10, 0, 제목 탭 1, 0) — 제목 탭이 서서 위 띠는 안 본다 */}
      <CommonPanel x={SPECIAL_TRAINING_PANEL.x} y={SPECIAL_TRAINING_PANEL.y} width={SPECIAL_TRAINING_PANEL.width}
        height={SPECIAL_TRAINING_PANEL.height} topBand={0x10} titleTab testId="필살타법-판" />
      {/* 0x802dc — 박스 2 칠 · 위(x..x+w−1, y) · 왼(x, y..y+h) #0A266F · 아래(x+1..x+w−1, y+h) · 오른(x+w−1, y+1..y+h) #5683F5 */}
      <svg style={layer} width={SCREEN.width} height={SCREEN.height} viewBox="0 0 240 320" shapeRendering="crispEdges" aria-hidden>
        <rect x={inner.x} y={inner.y} width={inner.width} height={inner.height} fill={SPECIAL_TRAINING_INNER_COLORS.fill} />
        <rect x={inner.x} y={inner.y} width={inner.width} height={1} fill={SPECIAL_TRAINING_INNER_COLORS.shade} />
        <rect x={inner.x} y={inner.y} width={1} height={inner.height + 1} fill={SPECIAL_TRAINING_INNER_COLORS.shade} />
        <rect x={inner.x + 1} y={inner.y + inner.height} width={inner.width - 1} height={1} fill={SPECIAL_TRAINING_INNER_COLORS.lit} />
        <rect x={inner.x + inner.width - 1} y={inner.y + 1} width={1} height={inner.height} fill={SPECIAL_TRAINING_INNER_COLORS.lit} />
      </svg>
      <FrameSprite folder={MODE_UI} frame={SPECIAL_TRAINING_LAYOUT_FRAME} origins={uiOrigins} x={0} y={0} />
      {titleAt !== null && (
        <div data-testid="필살타법-제목" data-frame={titleFrame}>
          <SolidStamp folder={IMG_TEXT} frame={titleFrame} origins={textOrigins} x={titleAt.x} y={titleAt.y}
            color={SPECIAL_TRAINING_TITLE_COLOR} />
        </div>
      )}
      {isTraining && <img alt="" src={G_COIN.src} style={{ position: 'absolute', left: G_COIN.x, top: G_COIN.y }} />}

      {SPECIAL_TRAINING_SLOT_BOXES.map((_, slot) => {
        const isCursorDrawn = slot === cursor && isBlinkOn
        const isLocked = isSlotLocked(slot, learnedCount)
        const region = lockRegionOf(slot, isCursorDrawn)
        return (
          <div key={slot} data-testid={`필살칸-${slot}`} data-locked={isLocked} data-in-use={isSlotIconInUse(slot, inUseNumber)}>
            {slotArt(slot, 0, 0)}
            {isCursorDrawn && (
              <PaintedRects x={cursorBox.x} y={cursorBox.y} width={cursorBox.width + 1} height={cursorBox.height + 1}
                paints={cursorPaints} testId="필살칸-커서" />
            )}
            {/* 0xc37a9 흑백 — 화면에 이미 그린 자리를 바꾼다. 같은 자리(안쪽 칠 + 칸 그림)를 원본 회색 식으로 칠해 다시 그린다 */}
            {isLocked && (
              <div data-testid={`필살칸-흑백-${slot}`} style={{
                position: 'absolute', left: region.x, top: region.y, width: region.width, height: region.height,
                overflow: 'hidden', pointerEvents: 'none', background: GRAY_INNER_FILL,
              }}>
                {slotArt(slot, -region.x, -region.y, true)}
              </div>
            )}
          </div>
        )
      })}

      <div data-testid="필살타법-이름" style={{
        position: 'absolute', left: SPECIAL_TRAINING_NAME_BOX.x, top: SPECIAL_TRAINING_NAME_BOX.y, width: SPECIAL_TRAINING_NAME_BOX.width,
        height: SPECIAL_TRAINING_NAME_BOX.height, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: SPECIAL_TRAINING_NAME_COLOR, fontSize: '11px', lineHeight: '13px', whiteSpace: 'nowrap', pointerEvents: 'none',
      }}>
        {slotNameOf(side, cursor, typeIndex)}
      </div>
      <div data-testid="필살타법-설명" style={{
        position: 'absolute', left: SPECIAL_TRAINING_DESCRIPTION_BOX.x, top: SPECIAL_TRAINING_DESCRIPTION_BOX.y,
        color: '#FFFFFF', fontSize: '11px', lineHeight: '13px', pointerEvents: 'none',
      }}>
        {descriptionLines.map((line, index) => (
          <p key={index} style={{ margin: 0, whiteSpace: 'pre' }}>
            {line.segments.map((segment, segmentIndex) => (
              <span key={segmentIndex} style={segment.color === null ? undefined : { color: segment.color }}>{segment.text}</span>
            ))}
          </p>
        ))}
      </div>

      {isTraining && (
        <div data-testid="필살타법-비용-횟수" data-cost={slotCostOf(cursor)} data-progress={`${progress.count}/${progress.required}`}>
          <SpriteNumber glyphs={numberGlyphsOf(slotCostOf(cursor))}
            right={SPECIAL_TRAINING_COST_BOX.x + SPECIAL_TRAINING_COST_BOX.width - 4}
            boxTop={SPECIAL_TRAINING_COST_BOX.y} boxHeight={SPECIAL_TRAINING_COST_BOX.height} />
          <img alt="" src={`${NUM}/${pad3(progress.count)}.png`} style={{ position: 'absolute', ...countAt }} />
          <img alt="" src={`${NUM}/${pad3(SPECIAL_TRAINING_SLASH_IMAGE)}.png`} style={{ position: 'absolute', ...slashAt }} />
          <img alt="" src={`${NUM}/${pad3(progress.required)}.png`} style={{ position: 'absolute', ...requiredAt }} />
          {timesAt !== null && (
            <FrameSprite folder={IMG_TEXT} frame={SPECIAL_TRAINING_TIMES_LABEL} origins={textOrigins} x={timesAt.x} y={timesAt.y} />
          )}
        </div>
      )}
      {label !== null && (
        <div data-testid="필살타법-글" data-label={label}>
          {labelAt !== null && <FrameSprite folder={IMG_TEXT} frame={label} origins={textOrigins} x={labelAt.x} y={labelAt.y} />}
        </div>
      )}

      {/* 마우스 길 — 칸 자리 투명 누름 칸. 누르면 그 칸으로 커서를 옮기고 확인한다 */}
      {SPECIAL_TRAINING_SLOT_BOXES.map((box, slot) => (
        <PressArea key={`칸${slot}`} label={slotNameOf(side, slot, typeIndex)} rect={box}
          option={{ isSelected: slot === cursor }} onPress={() => onPressSlot(slot)} />
      ))}
    </div>
  )
}
