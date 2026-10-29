import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { teamPitcherSkinIndexOf } from '@/features/play-team-game/model/teamGameRoster'
import { batterEquipmentOf, bodyTypeOf, NO_EQUIPMENT, pitcherEquipmentOfNibbles } from '@/widgets/batting-stage/lib/batterLayers'
import { stageWarmCastOf } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { StageBatterLook, StagePitcherLook, StageWarmCast } from '@/widgets/batting-stage/lib/renderBattingStage'
import { batterProfileOf } from './batterLooks'

/**
 * **곧 설 선수들의 그림 생김새** (`StageWarmCast`) — 공격 팀 명단 전부(타순 다음 · 벤치 대타)와 수비 팀 투수 명단 전부(교체 투수).
 * 원본은 타석 교대 0x47cc8 이 타자 몸통(47d98~47dd6 → 0x78ab0 · 피부 × 15 + 팀) · 장비(47e80~47eb6 → 0x78fd8) · 마운드 투수
 * (482c0~482fc → 0x793b0 · 피부 × 15 + 수비 팀, 48138~4816a → 0x79790)를 적재 때 칠하므로 교대 직후 첫 그림부터 제 색이다 —
 * 웹은 이 목록을 그림마다 미리 칠해 둔다. 값은 지금 선수를 그리는 길(`teamBattingStageBatterOf` · `teamPitcherSideStageOf` ·
 * `currentPitcherSkinIndex`)과 같은 칸에서 낸다. 마선수는 구운 그림이라 뺀다
 */
export function teamStageWarmCastOf(progress: TeamGameProgress, isOursBatting: boolean): StageWarmCast {
  const { options } = progress
  const battingTeam = isOursBatting ? options.ourTeamId : options.opponentTeamId
  const fieldingTeam = isOursBatting ? options.opponentTeamId : options.ourTeamId
  const batters = isOursBatting ? progress.ourEntry : progress.opponentEntry
  const pitchers = isOursBatting ? progress.opponentPitcherEntry : progress.ourPitcherEntry
  const batterLooks = batters.flatMap((entry): StageBatterLook[] => {
    if (entry.aceIndex >= 0) return []
    const profile = batterProfileOf(battingTeam, entry) ?? 0
    const [hit = 0, power = 0, , run = 0] = entry.equipment ?? []
    return [
      {
        bodyType: bodyTypeOf(profile >> 4),
        skinIndex: (profile >> 2) & 3,
        teamIndex: battingTeam,
        equipment: entry.equipment === undefined ? NO_EQUIPMENT : batterEquipmentOf({ hit, power, run }),
      },
    ]
  })
  const pitcherLooks = pitchers.flatMap((entry): StagePitcherLook[] =>
    entry.aceIndex >= 0
      ? []
      : [{ skinIndex: teamPitcherSkinIndexOf(fieldingTeam, entry), teamIndex: fieldingTeam, equipment: pitcherEquipmentOfNibbles(entry.equipment) }],
  )
  return stageWarmCastOf(batterLooks, pitcherLooks)
}
