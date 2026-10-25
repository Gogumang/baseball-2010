import { describe, expect, it } from 'vitest'
import { playerDetailOf } from '@/widgets/player-detail-window/lib/playerDetailWindow'
import { createCareer } from '@/entities/career/model/playerCareer'
import { nextOpponentOf } from '@/entities/career/model/playerCareer'
import { seatNariMatchAces, nariTeamsOf } from '@/entities/career/model/nariTeamRecord'
import { ENTRY_RESULT, ENTRY_SUB_TAB, ENTRY_TAB } from '@/entities/season-mode/model/entryEditor'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { ACE_BATTERS, ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { batterNariEntryViewOf, pressNariEntryKey } from '@/pages/management/lib/nariEntryView'
import type { NariEntryView } from '@/pages/management/lib/nariEntryView'
import { staminaCapacityOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { createNariCupTeams } from '@/entities/career/model/nariCupTeams'
import { entryBatterLineOfRecord, entryPitcherLineOfRecord } from '@/entities/season-mode/model/entryEditor'

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

  it('국가대항전 기록 열 — 붙박이 줄은 마스터 복사(Xls 행) 줄 · +0x2c 10000, 내 선수 줄은 커리어 시즌 줄 (0x205c0 · 0x20648 · 0x1fe5c · 0xb53f1)', () => {
    const base = createCareer('대회')
    const stats = { ...base.stats, atBats: 30, hits: 9, homeRuns: 2, runsBattedIn: 5, stolenBases: 1 }
    const nariCupTeams = { ...createNariCupTeams(2, 11), opponentMorale: 30 }
    const career = { ...base, stats, nariCupTeams }
    const korea = batterNariEntryViewOf(career, true, { myTeam: 10, opponent: 11 })
    const table = teamBatters(10)
    const mine = korea.lists.batters.find((row) => row.name === '대회')
    expect(mine?.batterLine).toMatchObject({ atBats: 30, hits: 9, homeRuns: 2, runsBattedIn: 5, steals: 1, errors: 0 })
    const other = korea.lists.batters.find((row) => row.name !== '대회')!
    const player = table.find((candidate) => candidate.name === other.name)!
    expect(player.recordLine.some((value) => value !== 0)).toBe(true)
    expect(other.batterLine).toEqual(entryBatterLineOfRecord(player.recordLine))
    const pitcher = korea.lists.pitchers[0]!
    const tablePitcher = teamPitchers(10).find((candidate) => candidate.name === pitcher.name)!
    expect(pitcher.pitcherLine).toEqual(entryPitcherLineOfRecord(tablePitcher.recordLine))
    expect(pitcher.stamina).toEqual({ capacity: staminaCapacityOf(tablePitcher.ability[3], 100, false), percent: 100 })
    // 상대국 칸 +2 — 대회 중 0xa3a24 가 읽고 쓰는 칸
    const opponent = batterNariEntryViewOf(career, false, { myTeam: 10, opponent: 11 })
    const theirPitcher = opponent.lists.pitchers[0]!
    expect(theirPitcher.stamina?.capacity).toBe(staminaCapacityOf(theirPitcher.ability[3] ?? 0, 30, false))
    expect(opponent.lists.batters.every((row) => row.batterLine !== undefined)).toBe(true)
  })

  it('기록 열 · 체력 줄 — 커리어 리그 기록표 줄 · 칸별 +0x2c 를 [ed+0x334] = 4 로 (0x16c0c~16c24 · 0x572a4)', () => {
    const { career } = 선수()
    const teamId = career.teamId
    const stats = {
      ...career.leaguePlayerStats,
      batters: { [teamId * 12]: { atBats: 40, hits: 12, homeRuns: 3, runsBattedIn: 9, errors: 2 } },
      pitchers: {
        [teamId * 8]: { outs: 30, runsAllowed: 4, saves: 0, strikeouts: 11, pitches: 150, wins: 1, losses: 0, games: 1, walks: 5 },
      },
    }
    const withStats = { ...career, leaguePlayerStats: stats, gamesPlayed: 3, leaguePitcherStaminas: { [teamId]: [6543] } }
    const view = batterNariEntryViewOf(withStats as typeof career, true)
    const batter = view.lists.batters.find((row) => row.name === teamBatters(teamId)[0].name)
    // +0x2e 실책 · +0x2a 사사구도 기록표 칸 그대로 (그림 0x43278 · 정산 꼬리 a8b04~a8bee)
    expect(batter?.batterLine).toMatchObject({ atBats: 40, hits: 12, homeRuns: 3, runsBattedIn: 9, errors: 2 })
    const pitcher = view.lists.pitchers.find((row) => row.name === teamPitchers(teamId)[0].name)
    expect(pitcher?.pitcherLine).toMatchObject({ outs: 30, strikeouts: 11, wins: 1, walks: 5 })
    expect(pitcher?.stamina?.percent).toBe(65)
  })

  it('사기 V[+2] — 상대는 그 팀이 마지막으로 선 경기 때의 나리 사기(teamRecordMorales), 내 팀은 커리어 사기, 옛 저장은 100 (r128)', () => {
    const { career, opponent } = 선수()
    const capacityOf = (view: NariEntryView) => view.lists.pitchers[0]?.stamina?.capacity
    const staminaOf = (view: NariEntryView) => view.lists.pitchers[0]?.ability[3] ?? 0
    const stale = { ...career, morale: 70, teamRecordMorales: { [opponent]: 20, [career.teamId]: 5 } }
    const theirs = batterNariEntryViewOf(stale, false)
    expect(capacityOf(theirs)).toBe(staminaCapacityOf(staminaOf(theirs), 20, false))
    expect(capacityOf(theirs)).not.toBe(staminaCapacityOf(staminaOf(theirs), 100, false))
    const mine = batterNariEntryViewOf(stale, true)
    expect(capacityOf(mine)).toBe(staminaCapacityOf(staminaOf(mine), 70, false))
    const old = batterNariEntryViewOf(career, false)
    expect(capacityOf(old)).toBe(staminaCapacityOf(staminaOf(old), 100, false))
  })
})

describe("143 '0' 상세 창 — 내 선수 줄 (0x5b798 타자 갈래 · 육성 연봉 5c848~5c872)", () => {
  it('타입 · 손 · 장착 스킬 · 필살 · 연봉(저장 +0x1c8 × 100)을 커리어에서 채운다', () => {
    const { career } = 선수()
    const me = { ...career, battingTypeIndex: 1, battingSide: 1, specialSwingNumber: 2, salary: 123, equippedSkillIds: [] }
    const row = batterNariEntryViewOf(me, true).lists.batters[7]
    expect(row.name).toBe('보기')
    expect(row.detailSource).toBeDefined()
    const detail = playerDetailOf(row.detailSource!)
    expect(detail.values.map((value) => value.text)).toEqual(['장타형', '좌타', '-', '플레임 스윙', '1억2300'])
    expect(row.profileLow).toBe(me.positionIndex & 3)
  })
})

describe('143 내 선수 줄의 기록 열 — 0x56ebc 가 줄 레코드 +0x20~ 를 그대로 읽는다 (r213)', () => {
  it('타율 · 홈런 칸이 커리어 시즌 줄(레코드 +0x20 타수 · +0x22 안타 · +0x28 홈런 · +0x2c 도루)로 선다', () => {
    const { career } = 선수()
    const stats = { ...career.stats, atBats: 40, hits: 13, doubles: 2, triples: 1, homeRuns: 5, runsBattedIn: 9, stolenBases: 3 }
    const row = batterNariEntryViewOf({ ...career, stats }, true).lists.batters[7]
    expect(row.batterLine).toEqual({ atBats: 40, hits: 13, doubles: 2, triples: 1, homeRuns: 5, runsBattedIn: 9, steals: 3, errors: 0 })
  })
})
