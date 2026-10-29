import { FrameSprite, SpriteNumber } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import {
  SPECIAL_TRAINING_COST_BOX,
  SPECIAL_TRAINING_COUNT_BOX,
  SPECIAL_TRAINING_SLASH_IMAGE,
  SPECIAL_TRAINING_TIMES_LABEL,
  slotCostOf,
} from '@/widgets/special-swing/lib/specialTrainingWindow'
import {
  IMG_TEXT,
  NUM,
  SLASH_SIZE,
  WHITE_DIGIT_HEIGHT,
  frameAt,
  imageAt,
  pad3,
  whiteDigitWidthOf,
} from '@/widgets/special-swing/ui/specialTrainingFigure/figureAssets'

interface TrainingCostProps {
  readonly cursor: number
  /** 이번 레벨에 쌓은 횟수 / 다음 레벨까지 (`slotProgressOf`) */
  readonly progress: { readonly count: number; readonly required: number }
  readonly textOrigins: FrameOrigins | null
}

/** 훈련 상태의 비용(G) · 횟수 "n / m" · "회" 글자 */
export function TrainingCost({ cursor, progress, textOrigins }: TrainingCostProps) {
  const timesAt = frameAt(textOrigins, SPECIAL_TRAINING_TIMES_LABEL, SPECIAL_TRAINING_COUNT_BOX, 0x24, -3)
  const countAt = imageAt(SPECIAL_TRAINING_COUNT_BOX, whiteDigitWidthOf(progress.count), WHITE_DIGIT_HEIGHT, 0x22, -10)
  const slashAt = imageAt(SPECIAL_TRAINING_COUNT_BOX, SLASH_SIZE, SLASH_SIZE, 0x22, 0)
  const requiredAt = imageAt(SPECIAL_TRAINING_COUNT_BOX, whiteDigitWidthOf(progress.required), WHITE_DIGIT_HEIGHT, 0x22, 10)
  return (
    <div data-testid="필살타법-비용-횟수" data-cost={slotCostOf(cursor)} data-progress={`${progress.count}/${progress.required}`}>
      <SpriteNumber
        glyphs={numberGlyphsOf(slotCostOf(cursor))}
        right={SPECIAL_TRAINING_COST_BOX.x + SPECIAL_TRAINING_COST_BOX.width - 4}
        boxTop={SPECIAL_TRAINING_COST_BOX.y}
        boxHeight={SPECIAL_TRAINING_COST_BOX.height}
      />
      <img alt="" src={`${NUM}/${pad3(progress.count)}.png`} style={{ position: 'absolute', ...countAt }} />
      <img alt="" src={`${NUM}/${pad3(SPECIAL_TRAINING_SLASH_IMAGE)}.png`} style={{ position: 'absolute', ...slashAt }} />
      <img alt="" src={`${NUM}/${pad3(progress.required)}.png`} style={{ position: 'absolute', ...requiredAt }} />
      {timesAt !== null && <FrameSprite folder={IMG_TEXT} frame={SPECIAL_TRAINING_TIMES_LABEL} origins={textOrigins} x={timesAt.x} y={timesAt.y} />}
    </div>
  )
}
