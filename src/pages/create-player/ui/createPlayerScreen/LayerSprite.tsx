import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { batterLayerPaletteIndex } from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterLayer } from '@/widgets/batting-stage/lib/batterLayers'
import { useRecoloredSprite } from '@/shared/lib/sprite/paletteSwap'
import * as styles from '@/pages/create-player/ui/CreatePlayerScreen.css'
import { FIGURE_FOOT } from './otherSlices'

/**
 * 선수 그림 한 겹 — 레이어마다 폴더가 달라 원점 파일도 따로 읽는다.
 *
 * `FrameSprite` 를 못 쓰고 `<img>` 를 직접 놓는 이유: 칠한 그림은 데이터 URL 이라 `src` 를 갈아야 하는데
 * `FrameSprite` 는 폴더·프레임으로 `src` 를 스스로 만든다. 자리 계산은 `FrameSprite` 와 같다.
 * ⚠️ 캔버스가 없으면(시험 DOM) `useRecoloredSprite` 가 조용히 구운 그림을 그대로 내보낸다.
 */
export function LayerSprite({
  layer,
  skinIndex,
  teamIndex,
}: {
  readonly layer: BatterLayer
  readonly skinIndex: number
  readonly teamIndex: number
}) {
  const origins = useFrameOrigins(layer.folder)
  const key = String(layer.frame).padStart(3, '0')
  const src = useRecoloredSprite(`${layer.folder}/${key}.png`, batterLayerPaletteIndex(layer.folder, skinIndex, teamIndex))
  const origin = origins?.[key]
  if (origin === undefined) return null
  return <img className={styles.layer} alt="" src={src} style={{ left: FIGURE_FOOT.x + origin.x, top: FIGURE_FOOT.y + origin.y }} />
}
