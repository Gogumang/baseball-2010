import { useEffect } from 'react'
import type { BatterAbility } from '@/entities/batting/model/batter'
import { preloadSprites } from '@/shared/lib/sprite/scenePreload'
import { batterEquipmentOf, bodyTypeOf, pitcherEquipmentOfNibbles } from '@/widgets/batting-stage/lib/batterLayers'
import { stageCastSpritePreloadsOf } from '@/widgets/batting-stage/lib/stageSpritePreload'

export interface StageCastNow {
  readonly batterForm: number
  /** 마타자 순번 (없으면 −1) */
  readonly aceBatterIndex: number
  readonly batterEquipmentLevels?: BatterAbility | undefined
  /** 마투수 순번 (없으면 null) */
  readonly acePitcherOrder: number | null
  readonly pitcherEquipmentNibbles?: readonly number[] | undefined
}

/**
 * 타석에 지금 선 타자 · 투수의 그림 전부(스윙 · 번트 · 투구 칸까지)를 받는다 — 타자가 바뀔 때마다.
 * 경기 진입 때 명단으로 받아 둔 목록(`app/model/gameSpritePreload`)이 놓친 선수(장비 · 마선수)를 여기서 잡는다.
 * 아무도 기다리지 않는다 — 그리기 루프는 예전처럼 온 그림부터 그린다.
 */
export function useStageCastPreload(cast: StageCastNow): void {
  const { batterForm, aceBatterIndex, batterEquipmentLevels, acePitcherOrder, pitcherEquipmentNibbles } = cast
  const hit = batterEquipmentLevels?.hit
  const power = batterEquipmentLevels?.power
  const run = batterEquipmentLevels?.run
  const nibbles = pitcherEquipmentNibbles?.join(',') ?? ''
  useEffect(() => {
    const bodyType = bodyTypeOf(batterForm)
    preloadSprites(
      stageCastSpritePreloadsOf({
        bodyTypes: [bodyType],
        ...(hit === undefined || power === undefined || run === undefined
          ? {}
          : { equippedBatters: [{ bodyType, equipment: batterEquipmentOf({ hit, power, run }) }] }),
        aceBatters: aceBatterIndex >= 0 ? [aceBatterIndex] : [],
        acePitchers: acePitcherOrder === null ? [] : [acePitcherOrder],
        pitcherEquipments: nibbles === '' ? [] : [pitcherEquipmentOfNibbles(nibbles.split(',').map(Number))],
      }),
      'scene',
    )
  }, [batterForm, aceBatterIndex, hit, power, run, acePitcherOrder, nibbles])
}
