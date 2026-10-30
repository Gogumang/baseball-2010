import { useWarmRecoloredSprites } from '@/shared/lib/sprite/paletteSwap'
import { batterLayerPaletteIndex, batterLayersOf, layerRecolorRequestsOf, NO_EQUIPMENT } from '@/widgets/batting-stage/lib/batterLayers'
import { CHOICES, FIGURE_POSE_FRAME } from '@/pages/create-player/lib/createPlayerLayout'

/**
 * 타입 · 피부 줄을 바꾸면 원본은 그림을 다시 적재해 곧바로 제 색이다 — 고를 수 있는 타입 × 피부 그림을 미리 칠해
 * 바꾼 그 그림에 구운 벌이 한 박자 비치지 않게
 */
export function useWarmRookieFigures(teamId: number) {
  useWarmRecoloredSprites(
    CHOICES.타입.options.flatMap((_, battingTypeIndex) =>
      CHOICES.피부.options.flatMap((__, skinIndex) =>
        layerRecolorRequestsOf(batterLayersOf(FIGURE_POSE_FRAME, battingTypeIndex, NO_EQUIPMENT, false), (layer) =>
          batterLayerPaletteIndex(layer.folder, skinIndex, teamId),
        ),
      ),
    ),
  )
}
