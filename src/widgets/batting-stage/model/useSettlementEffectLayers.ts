import { useMemo, useRef } from 'react'
import type { SettlementEffectLayers } from '@/widgets/batting-stage/model/stageRefs'

/**
 * 정산 효과 층 두 장의 ref — 같은 묶음을 `BattingStage` 의 `settlement.layers` 와 정산 판에 같이 넘긴다.
 * 타석 캔버스는 배경만 그리고, 비 · 파티클은 판이 원본 그리기 차례 자리에 깐 이 캔버스에 그린다 (`SettlementEffectLayers`).
 */
export function useSettlementEffectLayers(): SettlementEffectLayers {
  const rain = useRef<HTMLCanvasElement>(null)
  const particles = useRef<HTMLCanvasElement>(null)
  return useMemo(() => ({ rain, particles }), [])
}
