import { useMemo } from 'react'
import { CommonPanel, FrameSprite, PressArea, SolidStamp } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { roundEdgePaintsOf } from '@/shared/lib/commonPanel/commonPanel'
import {
  SPECIAL_TRAINING_CURSOR_COLOR,
  SPECIAL_TRAINING_LAYOUT_FRAME,
  SPECIAL_TRAINING_PANEL,
  SPECIAL_TRAINING_SLOT_BOXES,
  SPECIAL_TRAINING_STATUS_BOX,
  SPECIAL_TRAINING_TITLE_BOX,
  SPECIAL_TRAINING_TITLE_COLOR,
  SPECIAL_TRAINING_TITLE_OX,
  cursorBoxOf,
  isSlotInUse,
  isSpecialTrainingBlinkOn,
  slotDescriptionOf,
  slotNameOf,
  slotProgressOf,
  specialTrainingIconFrameOf,
  specialTrainingTitleFrameOf,
  statusLabelOf,
} from '@/widgets/special-swing/lib/specialTrainingWindow'
import type { SpecialTrainingSide, SpecialTrainingState } from '@/widgets/special-swing/lib/specialTrainingWindow'
import { G_COIN, IMG_TEXT, MODE_UI, frameAt } from '@/widgets/special-swing/ui/specialTrainingFigure/figureAssets'
import { TrainingCost } from '@/widgets/special-swing/ui/specialTrainingFigure/TrainingCost'
import { TrainingDescription, TrainingInnerBox, TrainingName } from '@/widgets/special-swing/ui/specialTrainingFigure/TrainingPanels'
import { TrainingSlot } from '@/widgets/special-swing/ui/specialTrainingFigure/TrainingSlot'

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
/**
 * **필살타법 · 마구 창 그림** — 0x803d4 탭 0 · 1 (배치 · 차례는 `lib/specialTrainingWindow` 머리글, 직접 떴다).
 * 타자 108 탭 0 · 123, 투수 108 탭 1 이 같은 그림을 쓴다.
 */
export function SpecialTrainingFigure({
  side,
  state,
  cursor,
  learnedCount,
  sessions,
  inUseNumber,
  typeIndex,
  onPressSlot,
}: SpecialTrainingFigureProps) {
  const uiOrigins = useFrameOrigins(MODE_UI)
  const textOrigins = useFrameOrigins(IMG_TEXT)
  // 상태 틱 [장면+0x2c] — 장면 프레임이 틀 머리에서 0xbc9c9(장면+0x18)로 세고, 상태가 바뀐 틀에 0(bc9ec) · 그 밖 틀마다 +1(bc9e2)이다.
  // 그리기는 같은 틀 뒤쪽이라 진입 틀의 그림이 0 을 읽는다(2026-10-24 직접 떴다). 웹은 창이 선 앱 틱을 0 으로 센다(`useUpdateCounter`)
  const tick = useUpdateCounter()
  const isBlinkOn = isSpecialTrainingBlinkOn(tick)
  const isTraining = state === '훈련'
  const iconFrame = specialTrainingIconFrameOf(side)
  const titleFrame = specialTrainingTitleFrameOf(side)
  const titleAt = frameAt(textOrigins, titleFrame, SPECIAL_TRAINING_TITLE_BOX, 0x21, SPECIAL_TRAINING_TITLE_OX)
  const label = statusLabelOf(state, cursor, learnedCount, isSlotInUse(cursor, inUseNumber, typeIndex))
  const labelAt = label === null ? null : frameAt(textOrigins, label, SPECIAL_TRAINING_STATUS_BOX, 0x22)
  const cursorBox = cursorBoxOf(cursor)
  const cursorPaints = useMemo(
    () => roundEdgePaintsOf(cursorBox.width, cursorBox.height, SPECIAL_TRAINING_CURSOR_COLOR),
    [cursorBox.width, cursorBox.height],
  )

  return (
    <div data-testid="필살타법-그림" data-side={side} data-state={state}>
      {/* 8046c 공용 판 0x55e61(skin, 박스 0, 0, 정렬 0x11, 위 띠 0x10, 0, 제목 탭 1, 0) — 제목 탭이 서서 위 띠는 안 본다 */}
      <CommonPanel
        x={SPECIAL_TRAINING_PANEL.x}
        y={SPECIAL_TRAINING_PANEL.y}
        width={SPECIAL_TRAINING_PANEL.width}
        height={SPECIAL_TRAINING_PANEL.height}
        topBand={0x10}
        titleTab
        testId="필살타법-판"
      />
      <TrainingInnerBox />
      <FrameSprite folder={MODE_UI} frame={SPECIAL_TRAINING_LAYOUT_FRAME} origins={uiOrigins} x={0} y={0} />
      {titleAt !== null && (
        <div data-testid="필살타법-제목" data-frame={titleFrame}>
          <SolidStamp folder={IMG_TEXT} frame={titleFrame} origins={textOrigins} x={titleAt.x} y={titleAt.y} color={SPECIAL_TRAINING_TITLE_COLOR} />
        </div>
      )}
      {isTraining && <img alt="" src={G_COIN.src} style={{ position: 'absolute', left: G_COIN.x, top: G_COIN.y }} />}

      {SPECIAL_TRAINING_SLOT_BOXES.map((_, slot) => (
        <TrainingSlot
          key={slot}
          slot={slot}
          iconFrame={iconFrame}
          inUseNumber={inUseNumber}
          learnedCount={learnedCount}
          textOrigins={textOrigins}
          isCursorDrawn={slot === cursor && isBlinkOn}
          cursorBox={cursorBox}
          cursorPaints={cursorPaints}
        />
      ))}

      <TrainingName name={slotNameOf(side, cursor, typeIndex)} />
      <TrainingDescription text={slotDescriptionOf(side, cursor, typeIndex)} />

      {isTraining && <TrainingCost cursor={cursor} progress={slotProgressOf(cursor, learnedCount, sessions)} textOrigins={textOrigins} />}
      {label !== null && (
        <div data-testid="필살타법-글" data-label={label}>
          {labelAt !== null && <FrameSprite folder={IMG_TEXT} frame={label} origins={textOrigins} x={labelAt.x} y={labelAt.y} />}
        </div>
      )}

      {/* 마우스 길 — 칸 자리 투명 누름 칸. 누르면 그 칸으로 커서를 옮기고 확인한다 */}
      {SPECIAL_TRAINING_SLOT_BOXES.map((box, slot) => (
        <PressArea
          key={`칸${slot}`}
          label={slotNameOf(side, slot, typeIndex)}
          rect={box}
          option={{ isSelected: slot === cursor }}
          onPress={() => onPressSlot(slot)}
        />
      ))}
    </div>
  )
}
