import { FrameSprite, SpriteNumber } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import {
  PITCH_TRAINING_COST_BOX,
  PITCH_TRAINING_COUNT_BOX,
  PITCH_TRAINING_SLASH_IMAGE,
  PITCH_TRAINING_STATUS_BOX,
  PITCH_TRAINING_TIMES_LABEL,
  pitchTrainingWindowCostOf,
} from '@/pages/pitcher-league/lib/pitchTrainingWindow'
import { IMG_TEXT, NUM, SLASH_SIZE, WHITE_DIGIT_HEIGHT, frameAt, imageCenterOf, pad3, whiteDigitWidthOf } from './figureLayout'

interface TrainingCostCountProps {
  /** 칸 격자 커서 0~5 — 비용은 자르지 않은 칸 번호로 고른다 */
  readonly cell: number
  readonly count: number
  readonly required: number
  readonly textOrigins: FrameOrigins | null
}

/**
 * 811a6 — 비용 0xba719(박스 3, 오른쪽 −4) · 횟수 "n/필요"(num 흰 숫자, 박스 5 가운데 ox −10 · 0 · +10) · img_text 260 "회"(정렬 0x24, ox −3).
 * 초점이 칸이고 상태 ≠ 0x7b 일 때만 부른다.
 */
export function TrainingCostCount({ cell, count, required, textOrigins }: TrainingCostCountProps) {
  const timesAt = frameAt(textOrigins, PITCH_TRAINING_TIMES_LABEL, PITCH_TRAINING_COUNT_BOX, 0x24, -3)
  const countAt = imageCenterOf(PITCH_TRAINING_COUNT_BOX, whiteDigitWidthOf(count), WHITE_DIGIT_HEIGHT, -10)
  const slashAt = imageCenterOf(PITCH_TRAINING_COUNT_BOX, SLASH_SIZE, SLASH_SIZE, 0)
  const requiredAt = imageCenterOf(PITCH_TRAINING_COUNT_BOX, whiteDigitWidthOf(required), WHITE_DIGIT_HEIGHT, 10)
  const cost = pitchTrainingWindowCostOf(cell)
  return (
    <div data-testid="구질훈련-비용-횟수" data-cost={cost} data-progress={`${count}/${required}`}>
      <SpriteNumber
        glyphs={numberGlyphsOf(cost)}
        right={PITCH_TRAINING_COST_BOX.x + PITCH_TRAINING_COST_BOX.width - 4}
        boxTop={PITCH_TRAINING_COST_BOX.y}
        boxHeight={PITCH_TRAINING_COST_BOX.height}
      />
      <img alt="" src={`${NUM}/${pad3(count)}.png`} style={{ position: 'absolute', ...countAt }} />
      <img alt="" src={`${NUM}/${pad3(PITCH_TRAINING_SLASH_IMAGE)}.png`} style={{ position: 'absolute', ...slashAt }} />
      <img alt="" src={`${NUM}/${pad3(required)}.png`} style={{ position: 'absolute', ...requiredAt }} />
      {timesAt !== null && <FrameSprite folder={IMG_TEXT} frame={PITCH_TRAINING_TIMES_LABEL} origins={textOrigins} x={timesAt.x} y={timesAt.y} />}
    </div>
  )
}

/** 81392 — 글 번호 > 0 이면 img_text[번호] 를 mode_ui 26 박스 4 에 정렬 0x22 (`statusLabelOf`) */
export function StatusLabel({ label, textOrigins }: { readonly label: number; readonly textOrigins: FrameOrigins | null }) {
  const labelAt = frameAt(textOrigins, label, PITCH_TRAINING_STATUS_BOX, 0x22)
  return (
    <div data-testid="구질훈련-글" data-label={label}>
      {labelAt !== null && <FrameSprite folder={IMG_TEXT} frame={label} origins={textOrigins} x={labelAt.x} y={labelAt.y} />}
    </div>
  )
}
