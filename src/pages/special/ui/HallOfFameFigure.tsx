import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { outfitPaletteIndex, useRecoloredSprite, useWarmRecoloredSprites } from '@/shared/lib/sprite/paletteSwap'
import {
  batterEquipmentOf,
  batterLayersOf,
  bodyTypeOf,
  layerPaletteIndexOf,
  layerRecolorRequestsOf,
  pitcherEquipmentOf,
  pitcherLayersOf,
} from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterLayer } from '@/widgets/batting-stage/lib/batterLayers'
import { PITCHER_FRAMES } from '@/widgets/batting-stage/lib/spriteLoader'
import { pitcherPoseFramesOf } from '@/widgets/batting-stage/lib/stageScenery'
import { HALL_OF_FAME_FIGURE, figureHandOf, pitcherImageDxOf } from '@/pages/special/lib/hallOfFameFigure'
import type { FigureDrawing, HallOfFameFigureLook } from '@/pages/special/lib/hallOfFameFigure'
import * as styles from '@/pages/special/ui/SpecialScreen.css'
import { figureBatterWarmLayersOf } from '@/pages/special/lib/figureWarmLayers'

/**
 * A 자리 몸 그림 (`lib/hallOfFameFigure.ts` 머리말).
 * - 타자: 겹침 타자 그림 vt+0x10 = 0x78cfd 를 (A.x, A.y + 0x2d) 에 바로. 그림자 끔(0x652d6 `그림+0x48 = 0`).
 *   잔상(batter_ghost)은 공용 생성자 0x767ec 가 +0x2c 에 늘 싣고 0x78eca 가 자세 8·9 에 끼우므로 그대로 둔다.
 *   우타(손 0)면 그림 x 를 축으로 뒤집는다(0x78d0c 효과 0x11 — 축은 타석 그림과 같은 근사).
 * - 투수: 54×75 이미지 [0x1552ae0] 를 (A.x − (손 ? 0x32 : 0x3b), A.y − 0x61) 에 **두 배로**(0x98975 효과 0x10 · 2) — 그 안 (27, 62) 에 단일 PZX 투수 그림
 *   0x79525(바탕 pitcher.pzx 팔레트 피부 × 15 + 팀 0x794c2 · 장비 여섯 칸 `pitcherLayersOf`). 좌완(손 ≠ 0)이면 뒤집는다(0x79544).
 *   이미지 밖은 잘린다(54×75 만 떠 둔다). 마젠타 투명 키라 빈 곳은 비친다.
 */
export function HallOfFameFigure({ drawing, ax, ay }: { readonly drawing: FigureDrawing; readonly ax: number; readonly ay: number }) {
  if (drawing.kind === '타자') {
    const { look, pose } = drawing
    const [hit, power, , run] = look.equipment
    const bodyType = bodyTypeOf(look.form)
    const equipment = batterEquipmentOf({ hit, power, run })
    const layers = batterLayersOf(pose, bodyType, equipment, false)
    return (
      <FigureLayers
        layers={layers}
        x={ax}
        y={ay + HALL_OF_FAME_FIGURE.batterDy}
        isMirrored={figureHandOf(look) === 0}
        paletteOf={(layer) => layerPaletteIndexOf(layer, look.skin, look.team)}
        testId="명전-타자그림"
        warmLayers={figureBatterWarmLayersOf(bodyType, equipment)}
      />
    )
  }
  if (drawing.kind === '투수') {
    const { image } = HALL_OF_FAME_FIGURE
    return (
      <div
        className={styles.hofFigureImage}
        data-testid="명전-투수그림"
        data-hand={drawing.hand}
        style={{
          left: ax + pitcherImageDxOf(drawing.hand),
          top: ay + HALL_OF_FAME_FIGURE.imageDy,
          width: image.width,
          height: image.height,
          transform: `scale(${HALL_OF_FAME_FIGURE.imageScale})`,
          transformOrigin: '0 0',
          imageRendering: 'pixelated',
        }}
      >
        {drawing.image !== null && <PitcherFigure look={drawing.image.look} pose={drawing.image.pose} />}
      </div>
    )
  }
  return null
}

/** 54×75 이미지 안의 단일 PZX 투수 그림 (27, 62) — 나리 투수편 카드 0x15e20 도 같은 이미지 [0x1552ae0] 를 쓴다 */
export function PitcherFigure({ look, pose }: { readonly look: HallOfFameFigureLook; readonly pose: number }) {
  const [control, velocity, breaking, stamina] = look.equipment
  const equipment = pitcherEquipmentOf({ control, velocity, breaking, stamina })
  const layers = pitcherLayersOf(pose, equipment)
  const { figureX, figureY } = HALL_OF_FAME_FIGURE.image
  return (
    <FigureLayers
      layers={layers}
      x={figureX}
      y={figureY}
      isMirrored={figureHandOf(look) !== 0}
      paletteOf={(layer) => layer.gradePaletteRow ?? (layer.folder === PITCHER_FRAMES ? outfitPaletteIndex(look.skin, look.team) : null)}
      testId="명전-투수몸"
      warmLayers={pitcherPoseFramesOf(null).flatMap((frame) => pitcherLayersOf(frame, equipment))}
    />
  )
}

export function FigureLayers({
  layers,
  x,
  y,
  isMirrored,
  paletteOf,
  testId,
  warmLayers = [],
}: {
  readonly layers: readonly BatterLayer[]
  readonly x: number
  readonly y: number
  readonly isMirrored: boolean
  readonly paletteOf: (layer: BatterLayer) => number | null
  readonly testId: string
  /**
   * 이 그림이 앞으로 그릴 수 있는 자세의 겹 — 미리 칠해 둔다(`useWarmRecoloredSprites`). 자세가 넘어가는 그 그림에
   * 구운 벌이 한 박자 비치지 않게 — 원본은 적재 때 팔레트를 갈아 끼운다
   */
  readonly warmLayers?: readonly BatterLayer[]
}) {
  useWarmRecoloredSprites(layerRecolorRequestsOf(warmLayers, paletteOf))
  return (
    <div
      className={styles.hofFigureAxis}
      data-testid={testId}
      data-mirrored={isMirrored ? 'true' : undefined}
      style={{ left: x, transform: isMirrored ? 'scaleX(-1)' : undefined }}
    >
      {layers.map((layer, index) => (
        <FigureLayer key={`${layer.folder}#${index}`} layer={layer} y={y} paletteIndex={paletteOf(layer)} />
      ))}
    </div>
  )
}

function FigureLayer({ layer, y, paletteIndex }: { readonly layer: BatterLayer; readonly y: number; readonly paletteIndex: number | null }) {
  const key = String(layer.frame).padStart(3, '0')
  const src = useRecoloredSprite(`${layer.folder}/${key}.png`, paletteIndex)
  const origin = useFrameOrigins(layer.folder)?.[key]
  if (origin === undefined) return null
  return <img className={styles.sprite} style={{ left: origin.x, top: y + origin.y }} src={src} alt="" />
}
