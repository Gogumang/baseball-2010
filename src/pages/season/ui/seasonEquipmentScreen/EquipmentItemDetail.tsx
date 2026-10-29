import { SpriteNumber } from '@/shared/ui'
import { PixelText } from '@/shared/ui/PixelText/PixelText'
import { moneyGlyphsOf, numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import {
  EQUIPMENT_COLORS,
  EQUIPMENT_WINDOW,
  effectOffsetsOf,
  equipmentDescriptionOf,
  equipmentEffectBonusOf,
  equipmentPriceTenThousandsOf,
  windowRowOf,
} from '@/pages/season/lib/seasonEquipmentWindow'
import { IMG_TEXT, NUM, PLUS_SIZE, TEXT_LINE, imageOf, pixel } from './equipmentAssets'
import { RightImage } from './EquipmentPieces'

interface EquipmentItemDetailProps {
  readonly isBatter: boolean
  readonly part: number
  readonly level: number
  readonly isHiddenOpen: (id: number) => boolean
  /** 값 칸 오른쪽 끝 — 값 상자 오른쪽에서 안쪽 여백만큼 */
  readonly valueRight: number
  readonly sizeOf: (frame: number) => { readonly width: number; readonly height: number } | undefined
}

/** 칸 목록에 들어가 있을 때만 — 가격 · 효과(이름 그림 + "+" + 숫자) · 설명 글 */
export function EquipmentItemDetail({ isBatter, part, level, isHiddenOpen, valueRight, sizeOf }: EquipmentItemDetailProps) {
  const { values, description } = EQUIPMENT_WINDOW
  const price = equipmentPriceTenThousandsOf(isBatter, part, level)
  const bonus = equipmentEffectBonusOf(level)
  const effectOffsets = effectOffsetsOf(bonus)
  const effectLabel = EQUIPMENT_WINDOW.effectLabelBase[isBatter ? '타자' : '투수'] + part
  const effectLabelSize = sizeOf(effectLabel)
  const effectRow = windowRowOf(values, 2)
  const descriptionText = equipmentDescriptionOf(isBatter, part, level, isHiddenOpen)
  return (
    <>
      <div data-testid="장비-가격" aria-label={String(price)}>
        <SpriteNumber glyphs={moneyGlyphsOf(price)} right={valueRight} boxTop={windowRowOf(values, 1).y} boxHeight={values.height} />
      </div>
      <div data-testid="장비-효과" aria-label={`+${bonus}`}>
        {effectLabelSize !== undefined && (
          <RightImage
            src={imageOf(IMG_TEXT, effectLabel)}
            box={effectRow}
            width={effectLabelSize.width}
            height={effectLabelSize.height}
            ox={effectOffsets.label}
          />
        )}
        <RightImage
          src={imageOf(NUM, EQUIPMENT_WINDOW.plusFrame)}
          box={effectRow}
          width={PLUS_SIZE}
          height={PLUS_SIZE}
          ox={effectOffsets.plus}
          oy={1}
        />
        <SpriteNumber glyphs={numberGlyphsOf(bonus)} right={valueRight} boxTop={effectRow.y} boxHeight={values.height} />
      </div>
      {descriptionText !== null && (
        <div data-testid="장비-설명" aria-label={descriptionText.replaceAll('!N', '\n')}>
          {descriptionText.split('!N').map((line, index) => (
            <PixelText
              key={index}
              style={{
                ...pixel,
                left: description.x + EQUIPMENT_WINDOW.descriptionInset,
                top: description.y + EQUIPMENT_WINDOW.descriptionInset + index * TEXT_LINE,
                color: EQUIPMENT_COLORS.cursor,
              }}
            >
              {line}
            </PixelText>
          ))}
        </div>
      )}
    </>
  )
}
