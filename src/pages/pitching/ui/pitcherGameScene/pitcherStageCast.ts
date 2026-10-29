import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import { teamBatters } from '@/entities/team/model/teamRoster'
import { opponentBatterOf } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { batterEquipmentOf, bodyTypeOf, NO_PITCHER_EQUIPMENT, pitcherEquipmentOf } from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterEquipment } from '@/widgets/batting-stage/lib/batterLayers'
import { stageWarmCastOf } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { StageWarmCast } from '@/widgets/batting-stage/lib/renderBattingStage'
import { aceBatterProfileOf, batterHandOf } from '@/widgets/matchup-cards/lib/matchupRecord'

type StageProgress = Parameters<typeof opponentBatterOf>[0]

/** 레코드 +0x19 · +0x1a 니블 → 장비 겹(0x78fd8). 부위 2(밴드)는 그림이 없다 */
const batterEquipmentOfNibbles = (nibbles: readonly number[]) =>
  batterEquipmentOf({ hit: nibbles[0] ?? 0, power: nibbles[1] ?? 0, run: nibbles[3] ?? 0 })

/** 장면 배치의 타자 손(0xb63c0, 장면 +0x17e1) — `PitcherSideStage` 가 그리는 손과 같은 값 */
export function stageBatterHandOf(progress: StageProgress): number {
  const batter = stageBatterOf(progress)
  return batter.batterSide ?? batter.batterForm & 1
}

/** 마운드의 내 투수 — 강판 뒤(onMound 거짓)면 피부 0 · 맨몸 */
function moundPitcherOf(progress: StageProgress, equipmentLevels: PitcherAbility | undefined, skinIndex: number) {
  return {
    skinIndex: progress.onMound ? skinIndex : 0,
    teamIndex: progress.options.ourTeamId,
    equipment: equipmentLevels === undefined || !progress.onMound ? NO_PITCHER_EQUIPMENT : pitcherEquipmentOf(equipmentLevels),
  }
}

/**
 * **나리 투수편 타석의 곧 설 그림** (`StageWarmCast`) — 상대 팀 붙박이 타자 명단 전부(덮개 니블이 있으면 그것 — `opponentBatterOf` 와
 * 같은 칸)와 마운드의 내 투수(피부 × 15 + 내 팀 · 장비 0x79790). 마타자는 구운 그림이라 칠할 것이 없다
 */
export function pitcherGameWarmCastOf(progress: StageProgress, equipmentLevels: PitcherAbility | undefined, skinIndex: number): StageWarmCast {
  const teamIndex = progress.options.opponentTeamId
  const batters = teamBatters(teamIndex).map((player, slot) => {
    const profile = player.profile
    const nibbles = progress.options.opponentEquipment?.batters?.[slot] ?? player.equipment
    return { bodyType: bodyTypeOf(profile >> 4), skinIndex: (profile >> 2) & 3, teamIndex, equipment: batterEquipmentOfNibbles(nibbles) }
  })
  return stageWarmCastOf(batters, [moundPitcherOf(progress, equipmentLevels, skinIndex)])
}

/**
 * 타석에 선 상대 타자의 그림 재료 — 폼 `rec[0xb] >> 4`(몸통 · 자세 · 손) · 피부 `(rec[0xb] >> 2) & 3` · 팀(헬멧 · 몸통 벌).
 * 마타자는 XlsACE_BAT_DATA 레코드 +0xb(`aceBatterProfileOf`)의 폼 · 피부, 손은 표 0xd88b0.
 * 마타자는 순번 0xb63a0 을 타석 교대 0x47dd6 이 몸통 적재 0x78ab0 에 넘겨 `ace/batter_*` 한 장을 싣는다(`aceBatterOrder`).
 */
export function stageBatterOf(progress: StageProgress): {
  readonly batterForm: number
  readonly batterSkinIndex: number
  readonly batterTeamIndex: number
  readonly batterSide?: number
  readonly aceBatterOrder?: number
  readonly batterEquipment?: BatterEquipment
} {
  const batter = opponentBatterOf(progress)
  const teamIndex = progress.options.opponentTeamId
  if (batter.aceIndex !== undefined) {
    const profile = aceBatterProfileOf(batter.aceIndex)
    return {
      batterForm: profile >> 4,
      batterSkinIndex: (profile >> 2) & 3,
      batterTeamIndex: teamIndex,
      batterSide: batterHandOf(profile, batter.aceIndex),
      aceBatterOrder: batter.aceIndex,
    }
  }
  const profile = batter.profile ?? 0
  const nibbles = batter.equipment
  return {
    batterForm: profile >> 4,
    batterSkinIndex: (profile >> 2) & 3,
    batterTeamIndex: teamIndex,
    // 타석 교대 0x47cc8 47e80~47eb6 — 마타자가 아니면 레코드 +0x19 · +0x1a 니블 − 1 로 장비 겹(0x78fd8). 부위 2(밴드)는 그림이 없다
    ...(nibbles === undefined ? {} : { batterEquipment: batterEquipmentOfNibbles(nibbles) }),
  }
}
