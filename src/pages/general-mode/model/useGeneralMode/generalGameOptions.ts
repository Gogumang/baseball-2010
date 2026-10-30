import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import type { TeamGameOptions, TeamSetupRolls } from '@/features/play-team-game/model/teamGameFlow'
import { seasonEntryOrderOf } from '@/entities/season-mode/model/seasonEntry'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import type { GeneralModeSetup } from '@/pages/general-mode/lib/generalModeSetup'
import { teamGameOptionsOf } from '@/pages/general-mode/lib/generalModeSetup'

/** 환경설정 · 마선수 레벨 — 넘기지 않은 칸은 경기 옵션에 안 넣는다 */
export interface GeneralGameSettings {
  readonly gaugeSettingOn: boolean | undefined
  readonly runningModeManual: boolean | undefined
  readonly throwModeManual: boolean | undefined
  readonly aceLevels: Readonly<Record<number, number>> | undefined
}

/** 지금 기록 · 설정 · 0x30f20 굴림 넷 · 고친 엔트리로 만든 경기 옵션 */
export function generalGameOptionsOf(
  setup: GeneralModeSetup,
  settings: MatchProgressSettings,
  extra: GeneralGameSettings,
  rolls: TeamSetupRolls | null,
  userEntryRoster: SeasonTeamRoster | null,
): TeamGameOptions {
  const { gaugeSettingOn, runningModeManual, throwModeManual, aceLevels } = extra
  return teamGameOptionsOf(setup, {
    settings,
    ...(gaugeSettingOn === undefined ? {} : { gaugeSettingOn }),
    ...(runningModeManual === undefined ? {} : { runningModeManual }),
    ...(throwModeManual === undefined ? {} : { throwModeManual }),
    ...(aceLevels === undefined ? {} : { aceLevels }),
    ...(rolls === null ? {} : { teamSetupRolls: rolls }),
    // 고친 차례는 맞바꾸기 전 모양 — 선발 칸 k 는 teamSetupRolls 가 든다
    ...(userEntryRoster === null ? {} : { ourEntryOrder: seasonEntryOrderOf(userEntryRoster) }),
  })
}
