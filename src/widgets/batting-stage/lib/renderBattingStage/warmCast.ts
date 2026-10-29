/** 곧 타석 · 마운드에 설 선수들의 그림 칠하기를 미리 걸기 (`StageScene.warmCast`) */
import type { BatterEquipment, PitcherEquipment } from '@/widgets/batting-stage/lib/batterLayers'
import { warmBatterRecolors } from '@/widgets/batting-stage/lib/renderBattingStage/batter/drawBatter'
import { warmPitcherRecolors } from '@/widgets/batting-stage/lib/renderBattingStage/pitcher/pitcherLook'

/** 타석 그림 생김새 하나 — 일반 타자(마타자는 구운 그림이라 칠할 것이 없다) */
export interface StageBatterLook {
  readonly bodyType: number
  readonly skinIndex: number
  readonly teamIndex: number
  readonly equipment: BatterEquipment
}

/** 마운드 그림 생김새 하나 — 평범한 투수(마투수는 구운 그림) */
export interface StagePitcherLook {
  readonly skinIndex: number
  readonly teamIndex: number
  readonly equipment: PitcherEquipment
}

export interface StageWarmCast {
  readonly batters: readonly StageBatterLook[]
  readonly pitchers: readonly StagePitcherLook[]
}

/** 생김새 목록 → 겹치는 것을 걷은 미리 칠하기 묶음 (리그 팀은 피부 셋 · 몸통 둘 · 맨몸이라 몇 벌 안 된다) */
export function stageWarmCastOf(batters: readonly StageBatterLook[], pitchers: readonly StagePitcherLook[]): StageWarmCast {
  const unique = <T>(looks: readonly T[]): T[] => [...new Map(looks.map((look) => [JSON.stringify(look), look])).values()]
  return { batters: unique(batters), pitchers: unique(pitchers) }
}

/**
 * 곧 설 선수들의 칠하기를 미리 건다 — 타자 · 투수 그리기가 거는 것과 **같은 열쇠**(`warmBatterRecolors` · `warmPitcherRecolors`)라
 * 교대 뒤 그 선수 첫 그림은 다시 걸 것 없이 칠한 칸을 쓴다. 다 건 열쇠는 다시 안 보므로 그림마다 불러도 된다
 */
export function warmStageCast(cast: StageWarmCast | null | undefined): boolean {
  if (cast === null || cast === undefined) return true
  let isAllWarmed = true
  for (const look of cast.batters) {
    if (!warmBatterRecolors(look.bodyType, look.skinIndex, look.teamIndex, look.equipment)) isAllWarmed = false
  }
  for (const look of cast.pitchers) {
    if (!warmPitcherRecolors(look.equipment, { skinIndex: look.skinIndex, teamIndex: look.teamIndex })) isAllWarmed = false
  }
  return isAllWarmed
}
