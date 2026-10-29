import { useEffect, useEffectEvent } from 'react'
import type { StadiumPreviewScene } from '@/pages/season/lib/stadiumPreviewScene'

/** 구장관리 진입이 잰 하늘은 곧장 장면 칸에 남기고, 상점은 나갈 때 흘린 전광판 글자 자리를 장면 칸에 돌려준다 */
export function useSceneHandover(
  isShop: boolean,
  entryScene: StadiumPreviewScene,
  scoreboardX: number,
  onPreviewSceneChange: ((scene: StadiumPreviewScene) => void) | undefined,
) {
  const enterScene = useEffectEvent(() => {
    if (!isShop) onPreviewSceneChange?.(entryScene)
  })
  const leaveScene = useEffectEvent(() => {
    if (isShop) onPreviewSceneChange?.({ ...entryScene, scoreboardX })
  })
  useEffect(() => {
    enterScene()
    return () => leaveScene()
  }, [])
}
