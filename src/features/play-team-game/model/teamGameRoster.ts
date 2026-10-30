/**
 * 팀 경기에 서는 선수의 **경기용 능력치**를 만든다 (J-4 를 로스터 표에 먹이는 자리).
 *
 * 웹판 로스터(`shared/config/original/roster.ts`)는 이름·능력치 네 칸뿐인 붙박이 표라
 * 원본 선수 레코드의 보직(+0xb)·스킬 비트(+0x14)가 없다. 그래서
 * **보직 불일치 −20% 의 입력은 부르는 쪽이 `lineup` 으로 넘긴다** — 안 넘기면 벌점이 없다.
 * 엔트리 편집기(0x55864, `entities/season-mode/model/entryEditor`)가 고친 타순·수비 위치(+0x1c)·투수 차례는
 * `TeamGameOptions.ourEntryOrder` 로 들어와 명단을 세운다 (`entryBattersOfOrder` · `entryPitchersOfOrder`).
 *
 * 하위 폴더 (`teamGameRoster/`): `abilityContext`(경기 능력치 문맥 · 팀 능력치 · 수비/주자 팀 보너스) · `aceLevel`(마선수 레벨 배율 0xb6414) ·
 * `rosterAbilities`(로스터 칸의 경기 능력치) · `entryTypes`(명단 칸 · 차례) · `entryBatters` · `entryPitchers`(마선수 끼우기 0xb8870 · 0xb88c8) ·
 * `entryOrder`(편집기 차례로 세운 명단) · `recordNibbles`(옛 저장 이사)
 */

export { defenseTeamBonusFor, runnerTeamGradeFor, type TeamGameAbilityContext } from '@/features/play-team-game/model/teamGameRoster/abilityContext'
export { aceLeveledAbility } from '@/features/play-team-game/model/teamGameRoster/aceLevel'
export {
  quickBatterFor,
  quickPitcherFor,
  stageBatterAbility,
  stagePitcherAbility,
} from '@/features/play-team-game/model/teamGameRoster/rosterAbilities'
export {
  NO_ACE_BATTER,
  NO_ROSTER_SLOT,
  PITCHER_ENTRY_ACE_SLOT,
  type TeamEntryBatter,
  type TeamEntryOrder,
  type TeamEntryPitcher,
} from '@/features/play-team-game/model/teamGameRoster/entryTypes'
export {
  entryBatterGameAbilities,
  rosterEntryBattersOf,
  withAceBatter,
  withEntryRecordSlots,
} from '@/features/play-team-game/model/teamGameRoster/entryBatters'
export {
  entryPitcherGameAbilities,
  entryPitcherGameAbilityParts,
  rosterEntryPitchersOf,
  teamPitcherSkinIndexOf,
  withAcePitcher,
} from '@/features/play-team-game/model/teamGameRoster/entryPitchers'
export { entryBattersOfOrder } from '@/features/play-team-game/model/teamGameRoster/entryBattersOrder'
export { entryPitchersOfOrder } from '@/features/play-team-game/model/teamGameRoster/entryPitchersOrder'
export { withBatterRecordNibbles, withPitcherRecordNibbles } from '@/features/play-team-game/model/teamGameRoster/recordNibbles'
