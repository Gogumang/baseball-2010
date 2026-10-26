import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { INNING_VALUE, MATCH_SETTING_KIND, type MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import { openMatchSettings, pressMatchSettingsKey, type MatchSettingsWindowState } from '@/pages/match-settings/lib/matchSettingsMenu'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 저장: MatchProgressSettings = {
  kind: MATCH_SETTING_KIND.이닝,
  value: INNING_VALUE.일곱째이닝부터,
  battingOrderBits: 0,
  pitchingInningBits: 0,
  offenseRunnerBits: 0,
  defenseRunnerBits: 0,
}

function 누름(state: MatchSettingsWindowState, ...keys: Parameters<typeof pressMatchSettingsKey>[1][]): MatchSettingsWindowState {
  let current = state
  for (const key of keys) {
    const action = pressMatchSettingsKey(current, key)
    if (action.kind !== '유지') throw new Error(action.kind)
    current = action.state
  }
  return current
}

describe('B-65 종류 OK 에서 값이 0 으로', () => {
  it('원본: 저장된 "6이닝 자동진행" 이 종류 OK 에서 "자동진행 없음" 으로', () => {
    expect(누름(openMatchSettings(저장), '확인').settings.value).toBe(INNING_VALUE.전체)
  })

  it('고침: 같은 종류면 저장된 값, 다른 종류면 0', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-65']))
    expect(누름(openMatchSettings(저장), '확인').settings.value).toBe(INNING_VALUE.일곱째이닝부터)
    const 찬스로 = 누름(openMatchSettings(저장), '위', '확인')
    expect(찬스로.settings.kind).toBe(MATCH_SETTING_KIND.찬스)
    expect(찬스로.settings.value).toBe(0)
  })
})
