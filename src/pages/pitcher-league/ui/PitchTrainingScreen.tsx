import { useEffect, useRef, useState } from 'react'
import { CommonPanel, FrameSprite, MessageBox, PressArea, SolidStamp, SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  PITCH_TRAINING_TABLE, PITCH_TRAINING_TEXT, pitchTrainingGateOf, pitchTypeNameOf,
} from '@/entities/pitcher-career/model/pitchTraining'
import {
  PITCH_TRAINING_CELL_BOXES, PITCH_TRAINING_CONNECTORS, PITCH_TRAINING_CONNECTOR_COLOR, PITCH_TRAINING_COST_BOX,
  PITCH_TRAINING_COUNT_BOX, PITCH_TRAINING_CURSOR_COLOR, PITCH_TRAINING_INNER, PITCH_TRAINING_INNER_COLORS,
  PITCH_TRAINING_LAYOUT_FRAME, PITCH_TRAINING_PANEL, PITCH_TRAINING_SLASH_IMAGE, PITCH_TRAINING_START,
  PITCH_TRAINING_STATUS_BOX, PITCH_TRAINING_TAB_MARK_FRAME, PITCH_TRAINING_TAB_STRIP, PITCH_TRAINING_TIMES_LABEL,
  PITCH_TRAINING_TREE_FRAME, cellColumnOf, cellLookOf, isPitchTrainingBlinkOn, pitchTrainingKeyOf,
  pitchTrainingKeyOutcomeOf, pitchTrainingWindowCostOf, pitchTrainingWindowProgressOf, statusLabelOf, tabMarkTopLeftOf,
  tabPressRectOf,
} from '@/pages/pitcher-league/lib/pitchTrainingWindow'
import type { PitchTrainingCursor } from '@/pages/pitcher-league/lib/pitchTrainingWindow'

const MODE_UI = './sprites/mode_ui/frames'
const IMG_TEXT = './sprites/img_text/frames'
const SLT_PITCH = './sprites/slt_pitch/frames'
/** gpoint 이미지 11 — G 동전 18×18 ([skin+0x9c] = ui/gpoint) 을 박스 3 에 정렬 0x21 · ox 2 (세로 (18 − 18)/2 = 0) */
const G_COIN = { src: './sprites/gpoint/011.png', x: PITCH_TRAINING_COST_BOX.x + 2, y: PITCH_TRAINING_COST_BOX.y } as const
/** num 흰 숫자 0~9 (8×10, "1" 만 4×10) · "/" 101 (10×10) */
const NUM = './sprites/num'
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

interface PitchTrainingScreenProps {
  readonly career: PitcherCareer
  /** [66] [예] — 125 로 가서 그 칸을 한 번 훈련한다 (`usePitcherManagementMenu.trainPitch`) */
  readonly onTrain: (row: number, column: number) => void
  /** 취소 → 107 (0x17828 17a76) */
  readonly onClose: () => void
}

/** 0x17a06~0x17a46 의 팝업 — [67] · [68] 은 알림(0x702b5 → 0x178cc), [65] (2,2) · [66] (2,3) 은 예/아니오 */
type Popup =
  | { readonly kind: '알림'; readonly text: string }
  | { readonly kind: 'G부족' }
  | { readonly kind: '확인'; readonly row: number; readonly column: number; readonly cost: number }

/**
 * **구질 훈련 창** — 나리 108 탭 2. 관리 화면(0x19da4) 위에 창 0x803d4 를 그린다 — 배치 · 그림 · 키는
 * `lib/pitchTrainingWindow` 머리글(직접 떴다). 웹 단추 대신 탭 · 칸 자리에 투명 누름 칸(`PressArea`)을 둔다.
 */
export function PitchTrainingScreen({ career, onTrain, onClose }: PitchTrainingScreenProps) {
  const [cursor, setCursor] = useState<PitchTrainingCursor>(PITCH_TRAINING_START)
  const [popup, setPopup] = useState<Popup | null>(null)
  const uiOrigins = useFrameOrigins(MODE_UI)
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const pitchOrigins = useFrameOrigins(SLT_PITCH)
  // ⚠️ 상태 틱 [장면+0x2c] 의 첫 그림 값은 안 읽었다 — 창이 선 뒤의 갱신 수로 센다
  const tick = useUpdateCounter()
  const isBlinkOn = isPitchTrainingBlinkOn(tick)

  /** 0x17912~0x17a46 칸 가드 */
  const confirm = (row: number, column: number) => {
    const gate = pitchTrainingGateOf(career, row, column)
    if (gate.kind === '무시') return
    if (gate.kind === '막힘') {
      if (gate.textIndex === PITCH_TRAINING_TEXT.notEnoughPoints) return setPopup({ kind: 'G부족' })
      return setPopup({ kind: '알림', text: ORIGINAL_MODE_TEXT[gate.textIndex] ?? '' })
    }
    setPopup({ kind: '확인', row, column, cost: gate.cost })
  }

  const latest = useRef({ cursor, popup, confirm, onClose })
  latest.current = { cursor, popup, confirm, onClose }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const held = latest.current
      // 팝업이 떠 있으면 MessageBox 가 키를 가져간다
      if (held.popup !== null) return
      const key = pitchTrainingKeyOf(event.key)
      if (key === null) return
      event.preventDefault()
      const outcome = pitchTrainingKeyOutcomeOf(held.cursor, key)
      if (outcome.kind === 'close') return held.onClose()
      if (outcome.kind === 'confirm') return held.confirm(outcome.row, outcome.column)
      setCursor(outcome.cursor)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const row = cursor.tab
  const column = cellColumnOf(cursor.cell)
  const label = statusLabelOf(career, row, column, cursor.isCellFocus)
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
    <div data-testid="구질훈련-창">
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
      <img alt="" src={G_COIN.src} style={{ position: 'absolute', left: G_COIN.x, top: G_COIN.y }} />
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

      {cursor.isCellFocus && (
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
          option={{ isSelected: tab === row }}
          onPress={() => setCursor({ ...cursor, tab, isCellFocus: false })} />
      ))}
      {PITCH_TRAINING_CELL_BOXES.map((box, cellColumn) => (
        <PressArea key={`칸${cellColumn}`} label={pitchTypeNameOf(PITCH_TRAINING_TABLE[row][cellColumn])} rect={box}
          option={{ isSelected: cursor.isCellFocus && cellColumn === column }}
          onPress={() => {
            setCursor({ ...cursor, isCellFocus: true, cell: cellColumn })
            confirm(row, cellColumn)
          }} />
      ))}

      {popup?.kind === '알림' && <MessageBox text={popup.text} buttons={['확인']} onAnswer={() => setPopup(null)} />}
      {popup?.kind === 'G부족' && (
        <MessageBox text={ORIGINAL_MODE_TEXT[PITCH_TRAINING_TEXT.notEnoughPoints] ?? ''} buttons={['예', '아니오']}
          onAnswer={(index) => {
            setPopup(null)
            // 예 → 139 G 충전(틀 0x106bc) — 웹에 결제가 없어 충전 없이 떠난 길만 옮긴다: 108 진입 0x17730 이 다시 돌아 커서가 처음으로.
            // ⚠️ 139 화면은 옮기지 않았다
            if (index === 0) setCursor(PITCH_TRAINING_START)
          }} />
      )}
      {popup?.kind === '확인' && (
        <MessageBox text={(ORIGINAL_MODE_TEXT[PITCH_TRAINING_TEXT.confirm] ?? '').replace('%d', String(popup.cost))}
          buttons={['예', '아니오']}
          onAnswer={(index) => {
            const chosen = popup
            setPopup(null)
            if (index === 0) onTrain(chosen.row, chosen.column)
          }} />
      )}
    </div>
  )
}
