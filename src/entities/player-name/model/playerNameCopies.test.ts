import { afterEach, describe, expect, it } from 'vitest'
import { BATTERS, PITCHERS } from '@/shared/config/original/roster'
import { EMPTY_EDITED_NAMES, withEditedName } from '@/entities/player-name/model/editedNames'
import { setActiveEditedNames } from '@/entities/player-name/model/playerName'
import { leaguePitcherRecordsOf, leagueRecordsOf } from '@/entities/awards/model/seasonAwards'
import { EMPTY_LEAGUE_PLAYER_STATS } from '@/entities/league/model/leaguePlayerStats'
import { seasonEntryListsOf, tableRosterOf } from '@/entities/season-mode/model/seasonEntry'

/**
 * 이름 복사본 조사 (0xb62c0 은 보일 때마다 id 로 다시 읽는다) — 웹이 붙박이 선수 이름을 **만들 때마다**
 * 게터에서 새로 읽어, 고친 이름이 순위표(0x9d789 → 0xb62c0)·시즌 명단 줄에 바로 나오는지 지킨다.
 * 저장에 이름을 복사해 두는 곳은 나리·명전 기록(id 0xb4~ · 0xfe — 이름표 칸 밖)뿐이고, 원본도 그 0x30 기록의
 * +1 에 이름을 두고 0xb62c0 이 칸 없음 → rec + 1 로 읽으므로 그대로다.
 */
afterEach(() => setActiveEditedNames(EMPTY_EDITED_NAMES))

describe('붙박이 선수 이름을 쓰는 표는 고친 이름을 다시 읽는다', () => {
  it('리그 타자·투수 순위표 줄 (0x9d789)', () => {
    const batter = BATTERS[0]
    const pitcher = PITCHERS[0]
    let table = withEditedName(EMPTY_EDITED_NAMES, batter.id, false, '타자고침')
    table = withEditedName(table, pitcher.id, true, '투수고침')
    setActiveEditedNames(table)

    expect(leagueRecordsOf(EMPTY_LEAGUE_PLAYER_STATS)[0]?.name).toBe('타자고침')
    expect(leaguePitcherRecordsOf(EMPTY_LEAGUE_PLAYER_STATS)[0]?.name).toBe('투수고침')
  })

  it('시즌 명단 줄 — 시즌 저장은 id 만 들고 이름은 그때그때 붙박이 표에서 읽는다', () => {
    const roster = tableRosterOf(0)
    const before = seasonEntryListsOf({ teamId: 0, roster, dayCounter: 0, acePitcherId: -1, aceBatterId: -1 })
    const firstBatter = before.batters[0]
    const original = BATTERS.find((player) => player.name === firstBatter?.name)
    expect(original).toBeDefined()

    setActiveEditedNames(withEditedName(EMPTY_EDITED_NAMES, original?.id ?? -1, false, '새이름'))
    const after = seasonEntryListsOf({ teamId: 0, roster, dayCounter: 0, acePitcherId: -1, aceBatterId: -1 })

    expect(after.batters[0]?.name).toBe('새이름')
  })
})
