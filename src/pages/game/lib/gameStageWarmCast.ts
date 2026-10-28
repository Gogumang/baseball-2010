import type { GameProgress } from '@/features/play-game/model/gameFlow'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { teamPitchers } from '@/entities/team/model/teamRoster'
import { batterEquipmentOf, bodyTypeOf, pitcherEquipmentOfNibbles } from '@/widgets/batting-stage/lib/batterLayers'
import { stageWarmCastOf } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { StageWarmCast } from '@/widgets/batting-stage/lib/renderBattingStage'

/**
 * **나리 타자편 타석의 곧 설 그림** (`StageWarmCast`) — 타석에 서는 것은 늘 내 선수이고, 마운드는 상대 팀 투수 명단 중 하나다.
 * 원본은 타석 교대 0x47cc8 이 타자 몸통(47d98~47dd6 → 0x78ab0, 피부 × 15 + 팀) · 마운드 투수(482c0~482fc → 0x793b0, 피부 × 15 +
 * 수비 팀 · 48138~4816a → 0x79790 장비)를 적재 때 칠한다. 값은 `GameScreen` 이 `BattingStage` 에 넘기는 것과 같은 칸에서 낸다 —
 * 투수는 `opponentPitcherEquipmentOf` · `opponentPitcherSkinIndexOf` 와 같은 붙박이 표 칸(덮개 니블이 있으면 그것)이다
 */
export function gameStageWarmCastOf(
  progress: GameProgress,
  career: Pick<PlayerCareer, 'battingTypeIndex' | 'battingSide' | 'skinIndex' | 'equipmentLevels'>,
): StageWarmCast {
  const batter = {
    bodyType: bodyTypeOf(career.battingTypeIndex * 2 + career.battingSide),
    skinIndex: career.skinIndex,
    // 타자 몸통 팀 = 경기[0x28 + 공격 측](0x47d00 0xb6bf9) — 국가대항전이면 대한민국(10)이라 경기의 내 팀 번호다
    teamIndex: progress.ourTeamId,
    equipment: batterEquipmentOf(career.equipmentLevels),
  }
  const teamId = progress.opponentTeamId
  const pitchers = teamPitchers(teamId).map((row, slot) => ({
    skinIndex: (row.profile >> 2) & 3,
    teamIndex: teamId,
    equipment: pitcherEquipmentOfNibbles(progress.opponentEquipment?.pitchers?.[slot] ?? row.equipment),
  }))
  return stageWarmCastOf([batter], pitchers)
}
