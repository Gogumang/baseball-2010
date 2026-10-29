import { PressArea } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCH_TRAINING_TABLE, pitchTypeNameOf } from '@/entities/pitcher-career/model/pitchTraining'
import {
  PITCH_TRAINING_CELL_BOXES,
  cellColumnOf,
  isPitchTrainingBlinkOn,
  pitchTrainingWindowProgressOf,
  statusLabelOf,
  tabMarkTopLeftOf,
  tabPressRectOf,
} from '@/pages/pitcher-league/lib/pitchTrainingWindow'
import type { PitchTrainingCursor, PitchWindowState } from '@/pages/pitcher-league/lib/pitchTrainingWindow'
import { IMG_TEXT, MODE_UI, SLT_PITCH } from './pitchWindowFigure/figureLayout'
import { PitchCells } from './pitchWindowFigure/PitchCells'
import { WindowBack } from './pitchWindowFigure/WindowBack'
import { StatusLabel, TrainingCostCount } from './pitchWindowFigure/WindowFooter'

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

  return (
    <div data-testid="구질창-그림" data-state={state}>
      <WindowBack uiOrigins={uiOrigins} isTraining={isTraining} tabMarkAt={cursor.isCellFocus || isBlinkOn ? tabMarkTopLeftOf(row) : null} />
      <PitchCells
        career={career}
        row={row}
        column={column}
        showsCursor={cursor.isCellFocus && isBlinkOn}
        uiOrigins={uiOrigins}
        pitchOrigins={pitchOrigins}
      />

      {/* 811a6 — 초점이 칸이고 상태 ≠ 0x7b 일 때만 */}
      {isTraining && cursor.isCellFocus && (
        <TrainingCostCount cell={cursor.cell} count={progress.count} required={progress.required} textOrigins={textOrigins} />
      )}
      {label !== null && <StatusLabel label={label} textOrigins={textOrigins} />}

      {/* 마우스 길 — 탭은 그 탭을 고르고(초점 탭 줄), 칸은 초점을 칸으로 옮겨 그 칸을 확인한다 */}
      {PITCH_TRAINING_TABLE.map((_, tab) => (
        <PressArea
          key={`탭${tab}`}
          label={`구질 계열 ${tab + 1}`}
          rect={tabPressRectOf(tab)}
          option={{ isSelected: tab === row }}
          onPress={() => onPressTab(tab)}
        />
      ))}
      {PITCH_TRAINING_CELL_BOXES.map((box, cellColumn) => (
        <PressArea
          key={`칸${cellColumn}`}
          label={pitchTypeNameOf(PITCH_TRAINING_TABLE[row][cellColumn])}
          rect={box}
          option={{ isSelected: cursor.isCellFocus && cellColumn === column }}
          onPress={() => onPressCell(cellColumn)}
        />
      ))}
    </div>
  )
}
