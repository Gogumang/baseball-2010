import { FrameSprite, PressArea, SolidStamp } from '@/shared/ui'
import { DescriptionBand } from '@/shared/ui/DescriptionBand/DescriptionBand'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { ROOKIE_BREAKING_PITCH_TYPES } from '@/entities/pitcher-career/model/pitcherRegistration'
import { pitchTypeNameOf } from '@/entities/pitcher-career/model/pitchTraining'
import { BREAKING_PITCH_OK_CELL } from '@/pages/pitcher-league/lib/breakingPitchCursor'
import {
  BREAKING_CHOSEN_PLATE,
  BREAKING_HINT,
  BREAKING_NAME_OUTLINE,
  BREAKING_OK,
  BREAKING_PITCH_FRAME,
  BREAKING_ROW_NUMBERS,
  BREAKING_ROW_NUMBER_BASE,
  REGISTER_YELLOW,
  breakingPitchBoxOf,
  breakingRowNumberBoxOf,
  cursorBoxOf,
} from '@/pages/pitcher-league/lib/pitcherRegisterLayout'
import { managementStyles } from './otherSlices'
import { MODE_UI, SLT_PITCH, frameAt, pad3 } from './registerFigure'
import { RoundEdge } from './RoundEdge'

/** StrMODE[12] 안내는 상태 틱 [this+0x2c] ≤ 0x31 일 때만 (0x16690~0x166b0) — 들어올 때마다 0 부터 센다 */
const PITCH_HINT_LAST_TICK = 0x31
/** num 50+숫자 — 8×10 */
const ROW_DIGIT = { width: 8, height: 10 } as const

interface BreakingPitchPickerProps {
  /** 고른 칸 (+0x13c..+0x143) */
  readonly chosenSlots: readonly number[]
  /** 격자 [this+0x88] 칸 — 0~7 구질 · 8 OK */
  readonly pitchCell: number
  readonly pitchTick: number
  readonly isBlinkOn: boolean
  readonly uiOrigins: FrameOrigins | null
  readonly pitchOrigins: FrameOrigins | null
  /** 구질 칸 누름 — 그 칸을 켜고/끈다 */
  readonly onToggle: (cell: number) => void
  /** OK 칸 누름 — 커서를 OK 칸에 두고 상자를 띄운다 */
  readonly onPressOk: () => void
}

/** 0x67 그리기 0x162bc — 판 mode_ui · 줄 번호 · 구질 여덟 칸(고른 칸은 판 + 검은 테 노랑 글) · 커서 · OK 칸 · StrMODE[12] 띠 */
export function BreakingPitchPicker({
  chosenSlots,
  pitchCell,
  pitchTick,
  isBlinkOn,
  uiOrigins,
  pitchOrigins,
  onToggle,
  onPressOk,
}: BreakingPitchPickerProps) {
  return (
    <div data-testid="변화구-고르기">
      <FrameSprite folder={MODE_UI} frame={BREAKING_PITCH_FRAME} origins={uiOrigins} x={0} y={0} />
      {BREAKING_ROW_NUMBERS.map((number, row) => {
        const box = breakingRowNumberBoxOf(row)
        // 0xba51c 정렬 0x22 · oy 1 — x += (w − 8) >> 1 · y += 올림((h − 10)/2) + 1
        const d = box.height - ROW_DIGIT.height
        return (
          <img
            key={number}
            alt=""
            className={managementStyles.layer}
            src={assetUrl(`./sprites/num/${pad3(BREAKING_ROW_NUMBER_BASE + number)}.png`)}
            style={{ left: box.x + ((box.width - ROW_DIGIT.width) >> 1), top: box.y + Math.trunc(d / 2) + (d % 2) + 1 }}
          />
        )
      })}
      {ROOKIE_BREAKING_PITCH_TYPES.map((typeNumber, cell) => {
        const box = breakingPitchBoxOf(cell)
        const frame = typeNumber - 1
        const at = frameAt(pitchOrigins, frame, box, 0x22)
        const isChosen = chosenSlots.includes(cell)
        return (
          <div key={typeNumber} data-testid={`변화구칸-${cell}`} data-chosen={isChosen}>
            {at !== null && !isChosen && <FrameSprite folder={SLT_PITCH} frame={frame} origins={pitchOrigins} x={at.x} y={at.y} />}
            {isChosen && <FrameSprite folder={MODE_UI} frame={BREAKING_CHOSEN_PLATE} origins={uiOrigins} x={box.x} y={box.y} />}
            {isChosen && at !== null && (
              <>
                {BREAKING_NAME_OUTLINE.map(([dx, dy]) => (
                  <SolidStamp
                    key={`${dx},${dy}`}
                    folder={SLT_PITCH}
                    frame={frame}
                    origins={pitchOrigins}
                    x={at.x + dx}
                    y={at.y + dy}
                    color="#000000"
                  />
                ))}
                <SolidStamp folder={SLT_PITCH} frame={frame} origins={pitchOrigins} x={at.x} y={at.y} color={REGISTER_YELLOW} />
              </>
            )}
            {cell === pitchCell && isBlinkOn && <RoundEdge box={cursorBoxOf(box)} color={REGISTER_YELLOW} />}
            <PressArea label={pitchTypeNameOf(typeNumber)} rect={box} option={{ isSelected: cell === pitchCell }} onPress={() => onToggle(cell)} />
          </div>
        )
      })}
      <FrameSprite
        folder={MODE_UI}
        frame={pitchCell === BREAKING_PITCH_OK_CELL ? BREAKING_OK.orange : BREAKING_OK.blue}
        origins={uiOrigins}
        x={BREAKING_OK.x}
        y={BREAKING_OK.y}
      />
      <PressArea label="OK" rect={BREAKING_OK} option={{ isSelected: pitchCell === BREAKING_PITCH_OK_CELL }} onPress={onPressOk} />
      {/* StrMODE[12] — 상태 틱 ≤ 0x31 동안만 */}
      {pitchTick <= PITCH_HINT_LAST_TICK && <DescriptionBand text={ORIGINAL_MODE_TEXT[BREAKING_HINT] ?? ''} seed={BREAKING_HINT} />}
    </div>
  )
}
