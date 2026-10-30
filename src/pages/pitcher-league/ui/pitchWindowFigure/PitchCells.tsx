import { FrameSprite, SolidStamp } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCH_TRAINING_CELL_BOXES, PITCH_TRAINING_CURSOR_COLOR, cellLookOf } from '@/pages/pitcher-league/lib/pitchTrainingWindow'
import { FULL_LAYER, MODE_UI, SCREEN, SLT_PITCH, frameAt } from './figureLayout'

interface PitchCellsProps {
  readonly career: PitcherCareer
  /** 탭 = 표 0xcc390 의 행(계열) */
  readonly row: number
  /** 커서 칸의 열 (`cellColumnOf`) */
  readonly column: number
  /** 초점이 칸이고 깜빡일 때 커서 테두리를 그린다 */
  readonly showsCursor: boolean
  readonly uiOrigins: FrameOrigins | null
  readonly pitchOrigins: FrameOrigins | null
}

/** 열 0~4 칸 (80e1c) — 판(`cellLookOf`) · 구질 이름(효과 0xb 단색), 그 위 칸 커서 테두리(0x810d8~0x8111a) */
export function PitchCells({ career, row, column, showsCursor, uiOrigins, pitchOrigins }: PitchCellsProps) {
  const cursorBox = PITCH_TRAINING_CELL_BOXES[column]
  return (
    <>
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
      {showsCursor && (
        <svg
          style={FULL_LAYER}
          width={SCREEN.width}
          height={SCREEN.height}
          viewBox="0 0 240 320"
          shapeRendering="crispEdges"
          data-testid="구질칸-커서"
        >
          {/* 0xb9ed5 테두리 (x−1, y−1, w+1, h+1) — 칸을 1px 둘러싼다 */}
          <rect
            x={cursorBox.x - 0.5}
            y={cursorBox.y - 0.5}
            width={cursorBox.width + 1}
            height={cursorBox.height + 1}
            fill="none"
            stroke={PITCH_TRAINING_CURSOR_COLOR}
            strokeWidth={1}
          />
        </svg>
      )}
    </>
  )
}
