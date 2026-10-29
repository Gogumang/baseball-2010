import { useEffect } from 'react'
import { bodyTypeOf } from '@/widgets/batting-stage/lib/batterLayers'
import { preloadSprites } from '@/shared/lib/sprite/scenePreload'
import { stageCastSpritePreloadsOf } from '@/widgets/batting-stage/lib/stageSpritePreload'
import type { PitcherSideStageProps } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideProps'

/**
 * 지금 타자의 장비 겹 그림(타석 교대 0x47cc8 47e80 → 0x78fd8) — 경기 진입 때 받은 목록이 놓친 타자(대타 · 굴린 장비)를 잡는다.
 * 아무도 안 기다린다 (타자편 `useStageCastPreload` 와 같다). 마타자는 장비를 안 싣는다
 */
export function useBatterEquipmentPreload({
  batterForm,
  batterEquipment,
  aceBatterOrder,
}: Pick<PitcherSideStageProps, 'batterForm' | 'batterEquipment' | 'aceBatterOrder'>): void {
  const head = batterEquipment?.head
  const hand = batterEquipment?.hand
  const leg = batterEquipment?.leg
  useEffect(() => {
    if (aceBatterOrder !== undefined || head === undefined || hand === undefined || leg === undefined) return
    preloadSprites(
      stageCastSpritePreloadsOf({ bodyTypes: [], equippedBatters: [{ bodyType: bodyTypeOf(batterForm), equipment: { head, hand, leg } }] }),
      'scene',
    )
  }, [batterForm, aceBatterOrder, head, hand, leg])
}
