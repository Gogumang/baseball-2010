import { BATTERS, PITCHERS } from '@/shared/config/original/roster'
import { leagueBatterIdOf, leaguePitcherIdOf } from '@/entities/league/model/leaguePlayerStats'
import { playerDetailOf as playerDetailOfRecord } from '@/widgets/player-detail-window/lib/playerDetailWindow'
import type { PlayerDetail } from '@/widgets/player-detail-window/lib/playerDetailWindow'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { substitutionDetailAbilities } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamEntryBatter, TeamEntryPitcher } from '@/features/play-team-game/model/teamGameRoster'
import { NO_ROSTER_SLOT } from '@/features/play-team-game/model/teamGameRoster'
import { entryProfileOf } from './entryProfile'

/**
 * 레코드 +0x1b — 상세 창 0x5b798 은 모드 2 에서 이 칸을 표 선수 · 영입 선수 가리지 않고 연봉으로 찍는다(5c87c~5c884).
 * 영입 선수(명전 · 나리 사본)는 기록 사본의 `salaryGrade`, 표 선수는 붙박이 표 행 값이다.
 * 원본 영입 선수는 레코드 통째 사본이라 +0x1b 가 늘 있다 — `salaryGrade` 없이 저장된 웹 옛 사본은 불러올 때 0 으로 이사한다
 * (명전 `migrateHallOfFamer` · 시즌 명단 `withRecordSalaryGrades`, r278 — 영입 때 값은 남아 있지 않아 예전에 찍던 0). 그래서 영입 기록
 * 선수는 늘 값이 있다. null 은 기록을 못 찾은 표 밖 선수(앱 길에서는 닿지 않는다)뿐이고 받는 쪽이 0 으로 찍는다
 */
function pitcherGradeOf(teamId: number, entry: TeamEntryPitcher): number | null {
  if (entry.salaryGrade !== undefined) return entry.salaryGrade
  if (entry.aceIndex >= 0 || entry.tableSlot === undefined) return null
  return PITCHERS[leaguePitcherIdOf(entry.tableTeamId ?? teamId, entry.tableSlot)]?.grade ?? null
}

function batterGradeOf(teamId: number, entry: TeamEntryBatter): number | null {
  if (entry.salaryGrade !== undefined) return entry.salaryGrade
  if (entry.aceIndex >= 0 || entry.rosterSlot === NO_ROSTER_SLOT) return null
  return BATTERS[leagueBatterIdOf(entry.tableTeamId ?? teamId, entry.rosterSlot)]?.grade ?? null
}

type DetailAbilities = NonNullable<ReturnType<typeof substitutionDetailAbilities>>

function pitcherDetailOf(progress: TeamGameProgress, index: number, abilities: DetailAbilities): PlayerDetail | null {
  const entry = progress.ourPitcherEntry[index]
  if (entry === undefined) return null
  const { form, magicId, pitchMask } = entry.repertoire
  return playerDetailOfRecord({
    isPitcher: true,
    abilities,
    aceIndex: entry.aceIndex,
    profile: 0,
    skillBits: entry.skillBits ?? 0,
    repertoire: { form, magicNumber: magicId, pitchMask },
    // 영입 기록 선수는 `salaryGrade`(+0x1b), 마선수는 행 값(`ACE_*_GRADES`) — `pitcherGradeOf`
    grade: pitcherGradeOf(progress.options.ourTeamId, entry),
  })
}

function batterDetailOf(progress: TeamGameProgress, index: number, abilities: DetailAbilities): PlayerDetail | null {
  const entry = progress.ourEntry[index]
  if (entry === undefined) return null
  // 레코드 +0x18 — 마타자는 순번 + 5, 붙박이 표 · 일반 레코드는 0 이다 (`teamGameFlow` 의 필살 남은 칸 주석, H2 4-2)
  return playerDetailOfRecord({
    isPitcher: false,
    abilities,
    aceIndex: entry.aceIndex,
    profile: entryProfileOf(progress, entry),
    skillBits: entry.skillBits ?? 0,
    specialNumber: 0,
    grade: batterGradeOf(progress.options.ourTeamId, entry),
  })
}

/** 상세 창 값 — 투수 `0xb8b09(팀, 커서)` · 타자 `0xb8b19(팀, 커서)` (0x384b8 → 0x37e5c 끝 0x38420) */
export function playerDetailOf(progress: TeamGameProgress, kind: '투수' | '대타', index: number): PlayerDetail | null {
  const abilities = substitutionDetailAbilities(progress, kind, index)
  if (abilities === null) return null
  return kind === '투수' ? pitcherDetailOf(progress, index, abilities) : batterDetailOf(progress, index, abilities)
}
