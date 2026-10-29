import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useRecoloredSprite, useWarmRecoloredSprites, outfitPaletteIndex } from '@/shared/lib/sprite/paletteSwap'
import { layerRecolorRequestsOf, pitcherLayersOf } from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterLayer } from '@/widgets/batting-stage/lib/batterLayers'
import { PITCHER_FRAMES } from '@/widgets/batting-stage/lib/spriteLoader'
import { SEASON_TRAINING_SKIN } from '@/pages/season/lib/seasonTrainingPopup'
import * as styles from '@/widgets/training-scene/ui/TrainingScene.css'

/**
 * 단일 PZX 투수 그림 0x79525 — 동작 번호 = pitcher.pzx 프레임 번호(0x795f6), +0x3d < 0(마투수 아님) 갈래의 겹 여섯 칸
 * (`pitcherLayersOf` — 새로 만든 객체라 장비 칸은 비어 있다). +0x3c = 0 이라 안 뒤집는다. 바탕 팔레트 = 피부 0 × 15 + 팀.
 */
export function PitcherTrainingFigure({
  pose,
  poses,
  teamIndex,
  x,
  y,
}: {
  readonly pose: number
  /** 이 애니가 낼 자세들 — 그 겹을 미리 칠해 둔다(자세가 넘어가는 그림에 구운 벌이 비치지 않게) */
  readonly poses: readonly number[]
  readonly teamIndex: number
  readonly x: number
  readonly y: number
}) {
  const paletteOf = (layer: BatterLayer) =>
    layer.gradePaletteRow ?? (layer.folder === PITCHER_FRAMES ? outfitPaletteIndex(SEASON_TRAINING_SKIN, teamIndex) : null)
  useWarmRecoloredSprites(
    layerRecolorRequestsOf(
      [...new Set(poses)].flatMap((shown) => pitcherLayersOf(shown)),
      paletteOf,
    ),
  )
  return (
    <div data-testid="시즌-훈련-투수" style={{ position: 'absolute', left: x, top: 0 }}>
      {pitcherLayersOf(pose).map((layer, index) => (
        <PitcherLayer key={`${layer.folder}#${index}`} layer={layer} y={y} paletteIndex={paletteOf(layer)} />
      ))}
    </div>
  )
}

function PitcherLayer({ layer, y, paletteIndex }: { readonly layer: BatterLayer; readonly y: number; readonly paletteIndex: number | null }) {
  const key = String(layer.frame).padStart(3, '0')
  const src = useRecoloredSprite(`${layer.folder}/${key}.png`, paletteIndex)
  const origin = useFrameOrigins(layer.folder)?.[key]
  if (origin === undefined) return null
  return <img className={styles.sprite} style={{ left: origin.x, top: y + origin.y }} src={src} alt="" />
}
