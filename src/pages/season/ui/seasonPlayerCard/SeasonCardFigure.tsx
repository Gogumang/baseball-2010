import { batterEquipmentOf, batterLayersOf, bodyTypeOf, layerPaletteIndexOf } from '@/widgets/batting-stage/lib/batterLayers'
import { SEASON_CARD_FIGURE } from '@/pages/season/lib/seasonPlayerCard'
import {
  FigureLayers,
  HALL_OF_FAME_FIGURE,
  PitcherFigure,
  figureBatterWarmLayersOf,
  figureHandOf,
  specialStyles,
  type HallOfFameFigureLook,
} from './otherSlices'

/** 0xae98 af28~af56 · 0xb1f8 b31a~b346 — 투수는 54×75 이미지를 두 배로, 타자는 겹침 그림을 박스 가운데 아래에 */
export function SeasonCardFigure({
  isPitcher,
  look,
  pose,
}: {
  readonly isPitcher: boolean
  readonly look: HallOfFameFigureLook
  readonly pose: number
}) {
  if (isPitcher) {
    const { image } = HALL_OF_FAME_FIGURE
    const { pitcherImage } = SEASON_CARD_FIGURE
    return (
      <div
        className={specialStyles.hofFigureImage}
        data-testid="시즌카드-투수그림"
        style={{
          left: pitcherImage.x,
          top: pitcherImage.y,
          width: image.width,
          height: image.height,
          transform: `scale(${pitcherImage.scale})`,
          transformOrigin: '0 0',
          imageRendering: 'pixelated',
        }}
      >
        <PitcherFigure look={look} pose={pose} />
      </div>
    )
  }
  const [hit, power, , run] = look.equipment
  const bodyType = bodyTypeOf(look.form)
  const equipment = batterEquipmentOf({ hit, power, run })
  const layers = batterLayersOf(pose, bodyType, equipment, false)
  return (
    <FigureLayers
      layers={layers}
      x={SEASON_CARD_FIGURE.batter.x}
      y={SEASON_CARD_FIGURE.batter.y}
      isMirrored={figureHandOf(look) === 0}
      paletteOf={(layer) => layerPaletteIndexOf(layer, look.skin, look.team)}
      testId="시즌카드-타자그림"
      warmLayers={figureBatterWarmLayersOf(bodyType, equipment)}
    />
  )
}
