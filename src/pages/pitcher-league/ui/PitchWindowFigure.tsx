import { CommonPanel, FrameSprite, PressArea, SolidStamp, SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCH_TRAINING_TABLE, pitchTypeNameOf } from '@/entities/pitcher-career/model/pitchTraining'
import {
  PITCH_TRAINING_CELL_BOXES, PITCH_TRAINING_CONNECTORS, PITCH_TRAINING_CONNECTOR_COLOR, PITCH_TRAINING_COST_BOX,
  PITCH_TRAINING_COUNT_BOX, PITCH_TRAINING_CURSOR_COLOR, PITCH_TRAINING_INNER, PITCH_TRAINING_INNER_COLORS,
  PITCH_TRAINING_LAYOUT_FRAME, PITCH_TRAINING_PANEL, PITCH_TRAINING_SLASH_IMAGE, PITCH_TRAINING_STATUS_BOX,
  PITCH_TRAINING_TAB_MARK_FRAME, PITCH_TRAINING_TAB_STRIP, PITCH_TRAINING_TIMES_LABEL, PITCH_TRAINING_TREE_FRAME,
  cellColumnOf, cellLookOf, isPitchTrainingBlinkOn, pitchTrainingWindowCostOf, pitchTrainingWindowProgressOf, statusLabelOf,
  tabMarkTopLeftOf, tabPressRectOf,
} from '@/pages/pitcher-league/lib/pitchTrainingWindow'
import type { PitchTrainingCursor, PitchWindowState } from '@/pages/pitcher-league/lib/pitchTrainingWindow'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const MODE_UI = assetUrl('./sprites/mode_ui/frames')
const IMG_TEXT = assetUrl('./sprites/img_text/frames')
const SLT_PITCH = assetUrl('./sprites/slt_pitch/frames')
/** gpoint 이미지 11 — G 동전 18×18 ([skin+0x9c] = ui/gpoint) 을 박스 3 에 정렬 0x21 · ox 2 (세로 (18 − 18)/2 = 0) */
const G_COIN = { src: assetUrl('./sprites/gpoint/011.png'), x: PITCH_TRAINING_COST_BOX.x + 2, y: PITCH_TRAINING_COST_BOX.y } as const
/** num 흰 숫자 0~9 (8×10, "1" 만 4×10) · "/" 101 (10×10) */
const NUM = assetUrl('./sprites/num')
const WHITE_DIGIT_HEIGHT = 10
const SLASH_SIZE = 10
const whiteDigitWidthOf = (digit: number) => (digit === 1 ? 4 : 8)
const SCREEN = { width: 240, height: 320 } as const

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
const pad3 = (frame: number) => String(frame).padStart(3, '0')

/** 0xb9e05 → 0xb9d74 프레임 맞춤: 0x2 가로 가운데(내림) · 0x4 오른쪽 · 0x20 세로 가운데(올림) — 원점은 FrameSprite 가 더한다 */
function frameAt(origins: FrameOrigins | null, frame: number, box: Box, align: number, ox = 0): { x: number; y: number } | null {
  const origin = origins?.[pad3(frame)]
  if (origin === undefined) return null
  let x = box.x + ox
  let y = box.y
  if ((align & 0x2) !== 0) x += (box.width - origin.width) >> 1
  if ((align & 0x4) !== 0) x += box.width - origin.width
  if ((align & 0x20) !== 0) {
    const d = box.height - origin.height
    y += Math.trunc(d / 2) + (d % 2)
  }
  return { x, y }
}

/** 0xb9d35 → 0xb9c5c 그림 가운데(정렬 0x22): 가로 d → trunc(d/2) + d%2 · 세로 trunc((h − ih)/2) */
function imageCenterOf(box: Box, width: number, height: number, ox: number) {
  const d = box.width - width
  return { left: box.x + Math.trunc(d / 2) + (d % 2) + ox, top: box.y + Math.trunc((box.height - height) / 2) }
}

interface PitchWindowFigureProps {
  readonly career: PitcherCareer
  readonly cursor: PitchTrainingCursor
  /** 108(0x6c) 구질 훈련 · 123(0x7b) 구질 고르기 */
  readonly state: PitchWindowState
  /** 탭 자리 누름 — 그 탭을 고른다(초점 탭 줄) */
  readonly onPressTab: (tab: number) => void
  /** 칸 자리 누름 — 초점을 칸으로 옮겨 그 칸을 확인한다 */
  readonly onPressCell: (cellColumn: number) => void
}

/**
 * **구질 창 그림** — 창 0x803d4 의 탭 2 갈래(배치 · 차례는 `lib/pitchTrainingWindow` 머리글, 직접 떴다).
 * 108 탭 2(구질 훈련, 0x19e44)와 123 탭 2(구질 고르기, 0x19e24)가 같은 그림이다 — 두 그리기 모두 관리 화면 0x19da4 뒤 0x803d4.
 * 상태 0x7b 면 G 동전(805a8) · 비용 · 횟수(8119e~811a4)를 건너뛰고 아래 글이 "장착"(0x127)으로 선다(`statusLabelOf`).
 * 웹 단추 대신 탭 · 칸 자리에 투명 누름 칸(`PressArea`)을 둔다.
 */
export function PitchWindowFigure({ career, cursor, state, onPressTab, onPressCell }: PitchWindowFigureProps) {
  const uiOrigins = useFrameOrigins(MODE_UI)
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const pitchOrigins = useFrameOrigins(SLT_PITCH)
  // 상태 틱 [장면+0x2c] — 장면 프레임이 틀 머리에서 0xbc9c9(장면+0x18)로 세고, 상태가 바뀐 틀에 0(bc9ec) · 그 밖 틀마다 +1(bc9e2)이다.
  // 그리기는 같은 틀 뒤쪽이라 진입 틀의 그림이 0 을 읽는다(2026-10-24 직접 떴다). 웹은 창이 선 앱 틱을 0 으로 센다(`useUpdateCounter`)
  const tick = useUpdateCounter()
  const isBlinkOn = isPitchTrainingBlinkOn(tick)
  const isTraining = state === '훈련'

  const row = cursor.tab
  const column = cellColumnOf(cursor.cell)
  const label = statusLabelOf(career, row, column, cursor.isCellFocus, state)
  const progress = pitchTrainingWindowProgressOf(career, row, column)
  const tabMark = tabMarkTopLeftOf(row)
  const timesAt = frameAt(textOrigins, PITCH_TRAINING_TIMES_LABEL, PITCH_TRAINING_COUNT_BOX, 0x24, -3)
  const labelAt = label === null ? null : frameAt(textOrigins, label, PITCH_TRAINING_STATUS_BOX, 0x22)
  const countAt = imageCenterOf(PITCH_TRAINING_COUNT_BOX, whiteDigitWidthOf(progress.count), WHITE_DIGIT_HEIGHT, -10)
  const slashAt = imageCenterOf(PITCH_TRAINING_COUNT_BOX, SLASH_SIZE, SLASH_SIZE, 0)
  const requiredAt = imageCenterOf(PITCH_TRAINING_COUNT_BOX, whiteDigitWidthOf(progress.required), WHITE_DIGIT_HEIGHT, 10)
  const cursorBox = PITCH_TRAINING_CELL_BOXES[column]
  const inner = PITCH_TRAINING_INNER
  const layer = { position: 'absolute', left: 0, top: 0, pointerEvents: 'none' } as const

  return (
    <div data-testid="구질창-그림" data-state={state}>
      {/* 8046c 공용 판 — 필살타법 창과 같은 인자 */}
      <CommonPanel x={PITCH_TRAINING_PANEL.x} y={PITCH_TRAINING_PANEL.y} width={PITCH_TRAINING_PANEL.width}
        height={PITCH_TRAINING_PANEL.height} topBand={0x10} titleTab testId="구질훈련-판" />
      {/* 0x802dc — 박스 2 칠 · 위(x..x+w−1, y) · 왼(x, y..y+h) #0A266F · 아래(x+1..x+w−1, y+h) · 오른(x+w−1, y+1..y+h) #5683F5 */}
      <svg style={layer} width={SCREEN.width} height={SCREEN.height} viewBox="0 0 240 320" shapeRendering="crispEdges" aria-hidden>
        <rect x={inner.x} y={inner.y} width={inner.width} height={inner.height} fill={PITCH_TRAINING_INNER_COLORS.fill} />
        <rect x={inner.x} y={inner.y} width={inner.width} height={1} fill={PITCH_TRAINING_INNER_COLORS.shade} />
        <rect x={inner.x} y={inner.y} width={1} height={inner.height + 1} fill={PITCH_TRAINING_INNER_COLORS.shade} />
        <rect x={inner.x + 1} y={inner.y + inner.height} width={inner.width - 1} height={1} fill={PITCH_TRAINING_INNER_COLORS.lit} />
        <rect x={inner.x + inner.width - 1} y={inner.y + 1} width={1} height={inner.height} fill={PITCH_TRAINING_INNER_COLORS.lit} />
      </svg>
      <FrameSprite folder={MODE_UI} frame={PITCH_TRAINING_LAYOUT_FRAME} origins={uiOrigins} x={0} y={0} />
      <FrameSprite folder={MODE_UI} frame={PITCH_TRAINING_TAB_STRIP.frame} origins={uiOrigins}
        x={PITCH_TRAINING_TAB_STRIP.x} y={PITCH_TRAINING_TAB_STRIP.y} />
      {/* 805a8 — 상태 ≠ 0x7b 일 때만 */}
      {isTraining && <img alt="" src={G_COIN.src} style={{ position: 'absolute', left: G_COIN.x, top: G_COIN.y }} />}
      <FrameSprite folder={MODE_UI} frame={PITCH_TRAINING_TREE_FRAME} origins={uiOrigins} x={0} y={0} />
      {(cursor.isCellFocus || isBlinkOn) && (
        <FrameSprite folder={MODE_UI} frame={PITCH_TRAINING_TAB_MARK_FRAME} origins={uiOrigins} x={tabMark.x} y={tabMark.y} />
      )}
      <svg style={layer} width={SCREEN.width} height={SCREEN.height} viewBox="0 0 240 320" shapeRendering="crispEdges" aria-hidden>
        {PITCH_TRAINING_CONNECTORS.map((box) => (
          <rect key={`${box.x},${box.y}`} x={box.x} y={box.y} width={box.width} height={box.height} fill={PITCH_TRAINING_CONNECTOR_COLOR} />
        ))}
      </svg>

      {PITCH_TRAINING_CELL_BOXES.map((box, cellColumn) => {
        const look = cellLookOf(career, row, cellColumn)
        const nameAt = frameAt(pitchOrigins, look.nameFrame, box, 0x22)
        return (
          <div key={cellColumn} data-testid={`구질칸-${cellColumn}`} data-plate={look.plate ?? '없음'} data-name-frame={look.nameFrame}>
            {look.plate !== null && <FrameSprite folder={MODE_UI} frame={look.plate} origins={uiOrigins} x={box.x} y={box.y} />}
            {nameAt !== null && (
              <SolidStamp folder={SLT_PITCH} frame={look.nameFrame} origins={pitchOrigins} x={nameAt.x} y={nameAt.y} color={look.nameColor} />
            )}
          </div>
        )
      })}
      {cursor.isCellFocus && isBlinkOn && (
        <svg style={layer} width={SCREEN.width} height={SCREEN.height} viewBox="0 0 240 320" shapeRendering="crispEdges"
          data-testid="구질칸-커서">
          {/* 0xb9ed5 테두리 (x−1, y−1, w+1, h+1) — 칸을 1px 둘러싼다 */}
          <rect x={cursorBox.x - 0.5} y={cursorBox.y - 0.5} width={cursorBox.width + 1} height={cursorBox.height + 1}
            fill="none" stroke={PITCH_TRAINING_CURSOR_COLOR} strokeWidth={1} />
        </svg>
      )}

      {/* 811a6 — 초점이 칸이고 상태 ≠ 0x7b 일 때만 */}
      {isTraining && cursor.isCellFocus && (
        <div data-testid="구질훈련-비용-횟수" data-cost={pitchTrainingWindowCostOf(cursor.cell)}
          data-progress={`${progress.count}/${progress.required}`}>
          <SpriteNumber glyphs={numberGlyphsOf(pitchTrainingWindowCostOf(cursor.cell))}
            right={PITCH_TRAINING_COST_BOX.x + PITCH_TRAINING_COST_BOX.width - 4}
            boxTop={PITCH_TRAINING_COST_BOX.y} boxHeight={PITCH_TRAINING_COST_BOX.height} />
          <img alt="" src={`${NUM}/${pad3(progress.count)}.png`} style={{ position: 'absolute', ...countAt }} />
          <img alt="" src={`${NUM}/${pad3(PITCH_TRAINING_SLASH_IMAGE)}.png`} style={{ position: 'absolute', ...slashAt }} />
          <img alt="" src={`${NUM}/${pad3(progress.required)}.png`} style={{ position: 'absolute', ...requiredAt }} />
          {timesAt !== null && (
            <FrameSprite folder={IMG_TEXT} frame={PITCH_TRAINING_TIMES_LABEL} origins={textOrigins} x={timesAt.x} y={timesAt.y} />
          )}
        </div>
      )}
      {label !== null && (
        <div data-testid="구질훈련-글" data-label={label}>
          {labelAt !== null && <FrameSprite folder={IMG_TEXT} frame={label} origins={textOrigins} x={labelAt.x} y={labelAt.y} />}
        </div>
      )}

      {/* 마우스 길 — 탭은 그 탭을 고르고(초점 탭 줄), 칸은 초점을 칸으로 옮겨 그 칸을 확인한다 */}
      {PITCH_TRAINING_TABLE.map((_, tab) => (
        <PressArea key={`탭${tab}`} label={`구질 계열 ${tab + 1}`} rect={tabPressRectOf(tab)}
          option={{ isSelected: tab === row }} onPress={() => onPressTab(tab)} />
      ))}
      {PITCH_TRAINING_CELL_BOXES.map((box, cellColumn) => (
        <PressArea key={`칸${cellColumn}`} label={pitchTypeNameOf(PITCH_TRAINING_TABLE[row][cellColumn])} rect={box}
          option={{ isSelected: cursor.isCellFocus && cellColumn === column }} onPress={() => onPressCell(cellColumn)} />
      ))}
    </div>
  )
}
