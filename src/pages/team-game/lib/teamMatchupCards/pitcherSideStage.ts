import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamEntryBatter, TeamEntryPitcher } from '@/features/play-team-game/model/teamGameRoster'
import { teamPitcherSkinIndexOf } from '@/features/play-team-game/model/teamGameRoster'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import { ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { batterEquipmentOf, pitcherEquipmentOfNibbles } from '@/widgets/batting-stage/lib/batterLayers'
import type { BatterEquipment, PitcherEquipment } from '@/widgets/batting-stage/lib/batterLayers'
import { acePitcherFramesOf } from '@/widgets/batting-stage/model/stageRefs'
import type { AcePitcherFrames } from '@/widgets/batting-stage/model/stageRefs'
import { aceBatterProfileOf } from '@/widgets/matchup-cards/lib/matchupRecord'
import { batterProfileOf, teamBatterHandOf } from './batterLooks'

/** 마운드 투수(수비 팀 = 우리)의 그림 재료 */
interface TeamMoundLook {
  readonly pitcherForm: number
  /** 마운드 투수 레코드 +0x18 (마구 · 마선수 번호) — 놓기 전 0x11 그림의 마구 공 파티클 갈래(0x3b2f4 3b4dc · Q-09) */
  readonly pitcherMagicNumber: number
  readonly pitcherHand: number
  readonly pitcherEquipment?: PitcherEquipment
  readonly pitcherSkinIndex: number
  readonly pitcherTeamIndex: number
  readonly acePitcher: AcePitcherFrames | null
}

/** 타석의 상대 타자 그림 재료 */
interface TeamStageBatterLook {
  readonly batterForm: number
  readonly batterSkinIndex: number
  readonly batterTeamIndex: number
  readonly batterSide?: number
  readonly aceBatterOrder?: number
  readonly batterEquipment?: BatterEquipment
}

/** 마투수가 아니고 장비 니블을 들면 장비 겹 0x79790 */
function moundEquipmentOf(pitcher: TeamEntryPitcher | undefined, isAce: boolean) {
  return isAce || pitcher?.equipment === undefined ? {} : { pitcherEquipment: pitcherEquipmentOfNibbles(pitcher.equipment) }
}

/** 마운드 — 마투수(0xb633c)면 0x482fc 의 적재 0x793b0 이 순번 0xb63a0 으로 `ace/pitcher_*`, 아니면 장비 겹 */
function teamMoundLookOf(progress: TeamGameProgress, pitcher: TeamEntryPitcher | undefined) {
  const pitcherForm = pitcher?.repertoire.form ?? 0
  const ace = pitcher === undefined ? undefined : ACE_PITCHERS[pitcher.aceIndex]
  return {
    pitcherForm,
    pitcherMagicNumber: pitcher?.repertoire.magicId ?? 0,
    pitcherHand: pitcher === undefined ? 0 : pitcherHandOf(pitcherForm, pitcher.aceIndex >= 0),
    // 마운드 바탕 벌 = 피부 × 15 + 수비 팀(482c0~482fc → 0x793b0 의 794c2) — 사람이 던지는 장면의 수비 팀 = 우리
    pitcherSkinIndex: teamPitcherSkinIndexOf(progress.options.ourTeamId, pitcher),
    pitcherTeamIndex: progress.options.ourTeamId,
    acePitcher: ace === undefined ? null : acePitcherFramesOf(ace),
    ...moundEquipmentOf(pitcher, ace !== undefined),
  }
}

/**
 * 타석 교대 0x47cc8 — 0x768b4 로 장비 칸을 비운 뒤 마타자가 아니면 47e80~47eb6 이 지금 타자 레코드(0xae89c(공격 팀 = 상대))
 * +0x19 · +0x1a 니블 − 1 로 장비 겹 0x78fd8 을 싣는다(모드 갈래 없음). 명단 칸의 니블 = Xls 행 · 시즌 저장 명단 · 기록 사본
 */
function batterEquipmentPropsOf(equipment: TeamEntryBatter['equipment']) {
  if (equipment === undefined) return {}
  return { batterEquipment: batterEquipmentOf({ hit: equipment[0] ?? 0, power: equipment[1] ?? 0, run: equipment[3] ?? 0 }) }
}

/** 타자 — 마타자는 XlsACE_BAT_DATA +0xb · 손 표 0xd88b0 · 순번, 그 밖은 레코드 +0xb 와 장비 니블 */
function teamStageBatterLookOf(teamId: number, batter: TeamEntryBatter | undefined): TeamStageBatterLook {
  if (batter === undefined) return { batterForm: 0, batterSkinIndex: 0, batterTeamIndex: teamId }
  if (batter.aceIndex >= 0) {
    const profile = aceBatterProfileOf(batter.aceIndex)
    return {
      batterForm: profile >> 4,
      batterSkinIndex: (profile >> 2) & 3,
      batterTeamIndex: teamId,
      batterSide: teamBatterHandOf(teamId, batter),
      aceBatterOrder: batter.aceIndex,
    }
  }
  const profile = batterProfileOf(teamId, batter) ?? 0
  return { batterForm: profile >> 4, batterSkinIndex: (profile >> 2) & 3, batterTeamIndex: teamId, ...batterEquipmentPropsOf(batter.equipment) }
}

/**
 * **사람이 던지는 타석 장면의 그림 재료** (`PitcherSideStage`) — 타자 `0xae89c(공격 팀 = 상대)` · 투수 `0xae83c(수비 팀 = 우리)`.
 * 타자: 폼 `rec[0xb] >> 4`(몸통 · 자세 · 손) · 피부 `(rec[0xb] >> 2) & 3` · 팀. 마타자는 XlsACE_BAT_DATA +0xb
 * (`aceBatterProfileOf`) · 손 표 0xd88b0. 표 밖 선수(영입한 명전·나리)는 웹 명단에 폼 칸이 없어 0.
 * 투수: 폼 · 손 0xb63c0. 타석 교대 0x47cc8 이 마운드 그림(장면 +0xf1c)을 다시 싣는다 — 마투수(0xb633c)면 0x482fc 의 적재 0x793b0 이
 * 순번 0xb63a0 으로 `ace/pitcher_*` 를(`acePitcher`), 아니면 48138~4816a 가 레코드 +0x19 · +0x1a 니블 − 1 로 장비 겹 0x79790 을
 * (`pitcherEquipment`) 싣는다. 투수편 · 투수 미션(0x108f8 → 0x10810 → 0x79790)과 같은 겹이다.
 */
export function teamPitcherSideStageOf(progress: TeamGameProgress): TeamStageBatterLook & TeamMoundLook {
  const teamId = progress.options.opponentTeamId
  const batter = progress.opponentEntry[progress.opponentOrderIndex]
  const mound = teamMoundLookOf(progress, progress.ourPitcherEntry[progress.ourPitcherIndex])
  return { ...teamStageBatterLookOf(teamId, batter), ...mound }
}
