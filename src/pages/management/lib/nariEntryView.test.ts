import { describe, expect, it } from 'vitest'
import { createCareer } from '@/entities/career/model/playerCareer'
import { nextOpponentOf } from '@/entities/career/model/playerCareer'
import { seatNariMatchAces, nariTeamsOf } from '@/entities/career/model/nariTeamRecord'
import { ENTRY_RESULT, ENTRY_SUB_TAB, ENTRY_TAB } from '@/entities/season-mode/model/entryEditor'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { ACE_BATTERS, ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { batterNariEntryViewOf, pressNariEntryKey } from '@/pages/management/lib/nariEntryView'
import type { NariEntryView } from '@/pages/management/lib/nariEntryView'

const 선수 = () => {
  const career = createCareer('보기')
  const opponent = nextOpponentOf(career)
  const nariTeams = seatNariMatchAces(nariTeamsOf(career), career.teamId, opponent, {
    myBatter: 1, myPitcher: 2, opponentPitcher: 3, opponentBatter: 4,
  })
  return { career: { ...career, nariTeams }, opponent }
}

const 누르기 = (view: NariEntryView, keys: Parameters<typeof pressNariEntryKey>[1][]) =>
  keys.reduce<{ view: NariEntryView; leaves: boolean }>((before, key) => pressNariEntryKey(before.view, key), {
    view,
    leaves: false,
  })

describe('143 경기 전 엔트리 보기 — 진입 0x16af8 (0x5561c 셋째 인자 0 → 보기 전용)', () => {
  it('내 팀 — 레코드 차례 그대로: 7번 칸 내 선수 · 9번 마타자 · 맨 끝 벤치, 투수는 오늘 차례 + 8번 마투수', () => {
    const { career } = 선수()
    const view = batterNariEntryViewOf(career, true)
    expect(view.teamId).toBe(career.teamId)
    expect(view.editor.tab).toBe(ENTRY_TAB.투수)
    expect(view.editor.subTab).toBe(ENTRY_SUB_TAB.보기전용)
    const names = view.lists.batters.map((row) => row.name)
    const table = teamBatters(career.teamId)
    expect(names[7]).toBe('보기')
    expect(names[9]).toBe(ACE_BATTERS[1].name)
    expect(view.lists.batters[9].isAce).toBe(true)
    expect(names.slice(-2)).toEqual([table[7].name, table[9].name])
    expect(view.lists.pitchers).toHaveLength(9)
    expect(view.lists.pitchers[8]).toMatchObject({ name: ACE_PITCHERS[2].name, isAce: true })
    expect(view.lists.pitchers[0].name).toBe(teamPitchers(career.teamId)[0].name)
  })

  it('상대 팀 — 붙박이 + 142 의 마선수', () => {
    const { career, opponent } = 선수()
    const view = batterNariEntryViewOf(career, false)
    expect(view.teamId).toBe(opponent)
    expect(view.lists.batters[9]).toMatchObject({ name: ACE_BATTERS[4].name, isAce: true })
    expect(view.lists.pitchers[8]).toMatchObject({ name: ACE_PITCHERS[3].name, isAce: true })
  })

  it('OK 가 안 먹는다 — 줄을 고르지도 바꾸지도 못하고 마선수 잠금 창도 안 뜬다', () => {
    const { career } = 선수()
    const view = batterNariEntryViewOf(career, true)
    const pressed = 누르기(view, ['확인', '아래', '확인', '별', '확인'])
    expect(pressed.view.lists).toEqual(view.lists)
    expect(pressed.view.editor.first).toBe(-1)
    expect(pressed.view.editor.tab).toBe(ENTRY_TAB.타자)
    expect(pressed.leaves).toBe(false)
  })

  it('키 0x1457c — CLR 은 늘, 내 팀은 오른 끝(3) · 상대 팀은 왼 끝(2) 에서만 142 로', () => {
    const { career } = 선수()
    const mine = batterNariEntryViewOf(career, true)
    const theirs = batterNariEntryViewOf(career, false)
    expect(pressNariEntryKey(mine, '취소').leaves).toBe(true)
    expect(pressNariEntryKey(mine, '왼')).toMatchObject({ leaves: false })
    expect(pressNariEntryKey(mine, '왼').view.editor.result).toBe(ENTRY_RESULT.왼쪽끝)
    expect(pressNariEntryKey(mine, '오른').leaves).toBe(true)
    expect(pressNariEntryKey(theirs, '오른').leaves).toBe(false)
    expect(pressNariEntryKey(theirs, '왼').leaves).toBe(true)
    expect(pressNariEntryKey(theirs, '취소').leaves).toBe(true)
  })

  it('국가대항전 — 대회 두 팀은 붙박이 표로 보인다(웹이 대회 레코드를 저장하지 않는다)', () => {
    const view = batterNariEntryViewOf(createCareer('대회'), true, { myTeam: 10, opponent: 11 })
    expect(view.teamId).toBe(10)
    expect(view.lists.batters.map((row) => row.name)).toEqual(teamBatters(10).map((player) => player.name))
    expect(view.lists.pitchers.map((row) => row.name)).toEqual(teamPitchers(10).map((player) => player.name))
  })
})
