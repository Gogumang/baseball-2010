import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { PLAYER_SIDE_FIRST_BAT, PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import {
  applyBatterOutcome,
  confirmScene,
  currentPitcherEquipment,
  moundStaminaOf,
  startTeamGame,
} from '@/features/play-team-game/model/teamGameFlow'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'
import { staminaCapacityOf, staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { pitcherHandOf } from '@/entities/pitching/model/pitcherHand'
import { BATTERS, PITCHERS } from '@/shared/config/original/roster'
import { leagueBatterIdOf, leaguePitcherIdOf } from '@/entities/league/model/leaguePlayerStats'
import {
  XLS_ROW_MATCHUP_RECORDS,
  teamBatterHandOf,
  teamIntroBatterHandOf,
  teamBattingStageBatterOf,
  teamMatchupCardsOf,
  opponentBatterRecordsOf,
  teamPitcherSideStageOf,
} from '@/pages/team-game/lib/teamMatchupCards'
import { ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { batterEquipmentOf, pitcherEquipmentOfNibbles } from '@/widgets/batting-stage/lib/batterLayers'
import { NO_ROSTER_SLOT, withAceBatter, withAcePitcher } from '@/features/play-team-game/model/teamGameRoster'

const 기본옵션: TeamGameOptions = {
  mode: 2,
  ourTeamId: 0,
  opponentTeamId: 1,
  playerSide: PLAYER_SIDE_LAST_BAT,
  season: { illness: 0, morale: 100, coach: -1 },
}

describe('팀경기 상태 0xe 소개 판 값 (0x44944)', () => {
  it('우리가 던지면 투수 PLAYER — 이름·보직·손(0xb63c0)·체력 막대(0x66e44 / 1449 · 0xaebb0)를 지금 마운드에서 읽는다', () => {
    const progress = startTeamGame(기본옵션, createSeededRandom(1))
    const { pitcher, batter } = teamMatchupCardsOf(progress)
    const entry = progress.ourPitcherEntry[progress.ourPitcherIndex]!
    expect(pitcher.isComputer).toBe(false)
    expect(batter.isComputer).toBe(true)
    expect(pitcher.name).toBe(entry.name)
    expect(pitcher.throwsLeft).toBe(pitcherHandOf(entry.repertoire.form, entry.aceIndex >= 0) === 1)
    const mound = moundStaminaOf(progress, true)
    expect(pitcher.stamina).toEqual({
      lengthValue: staminaCapacityOf(mound.staminaAbility, mound.teamMorale, true),
      // 아직 교체가 없다 (팀[+0x26] − 팀[+0x33] == 1) → 1449
      maxValue: 1449,
      percent: staminaPercentOf(progress.stamina),
    })
    // 시즌 줄 출처를 안 주면 비운다
    expect(pitcher.earnedRunAverage).toBeUndefined()
    expect(batter.battingAverage).toBeUndefined()
  })

  it('타자 손은 레코드 +0xb 폼 니블의 낮은 비트, 오늘 타석 기록은 그 타순 칸 링이다', () => {
    const random = createSeededRandom(3)
    let progress = startTeamGame({ ...기본옵션, playerSide: PLAYER_SIDE_FIRST_BAT }, random)
    progress = confirmScene(progress, random)
    const first = teamMatchupCardsOf(progress)
    const entry = progress.ourEntry[progress.game.battingOrderIndex]!
    const profile = BATTERS[leagueBatterIdOf(0, entry.rosterSlot)]!.profile
    expect(first.batterHand).toBe((profile >> 4) & 1)
    expect(first.batter.recentResults).toEqual([])
    const slot = progress.game.battingOrderIndex
    const after = applyBatterOutcome(progress, { kind: '삼진' }, random)
    // 같은 칸이 다시 타석에 서면(아홉 타자 뒤) 링에 삼진 7 이 남아 있다
    expect(after.ourEntryRecords[slot]?.results).toEqual([7])
  })

  it('시즌 줄은 리그 기록표 줄 + 이 경기 줄 — 방어율 0xb6ce8 · 탈삼진 · 타율 0xb8e3c · 홈런 · 타점', () => {
    const progress = startTeamGame(기본옵션, createSeededRandom(1))
    const entry = progress.ourPitcherEntry[progress.ourPitcherIndex]!
    const batterEntry = progress.opponentEntry[progress.opponentOrderIndex]!
    const stats = {
      batters: { [leagueBatterIdOf(1, batterEntry.rosterSlot)]: { atBats: 40, hits: 13, homeRuns: 2, runsBattedIn: 9 } },
      pitchers: {
        [leaguePitcherIdOf(0, entry.tableSlot!)]: {
          outs: 81,
          runsAllowed: 10,
          saves: 0,
          strikeouts: 22,
          pitches: 300,
          wins: 2,
          losses: 1,
        },
      },
    }
    const { pitcher, batter } = teamMatchupCardsOf(progress, { stats, countsThisGame: true })
    // 10 × 2700 / 81 = 333 → 3.33
    expect(pitcher.earnedRunAverage).toBe(333)
    expect(pitcher.strikeouts).toBe(22)
    // 13 × 1000 / 40 = 325
    expect(batter.battingAverage).toBe(325)
    expect(batter.homeRuns).toBe(2)
    expect(batter.runsBattedIn).toBe(9)
  })

  it('일반모드(1)는 레코드가 Xls 행 사본 — 행 바이트 32~43 의 줄 그대로(게이트 거짓이라 이 경기 줄 없음)', () => {
    const progress = startTeamGame({ ...기본옵션, mode: 1 }, createSeededRandom(1))
    const entry = progress.ourPitcherEntry[progress.ourPitcherIndex]!
    const batterEntry = progress.opponentEntry[progress.opponentOrderIndex]!
    const { pitcher, batter } = teamMatchupCardsOf(progress, XLS_ROW_MATCHUP_RECORDS)
    const [outs, runs, , strikeouts] = PITCHERS[leaguePitcherIdOf(0, entry.tableSlot!)]!.recordLine
    expect(pitcher.earnedRunAverage).toBe(Math.min(9999, Math.trunc((runs! * 2700) / outs!)))
    expect(pitcher.strikeouts).toBe(strikeouts)
    const [atBats, hits, , , homeRuns, runsBattedIn] = BATTERS[leagueBatterIdOf(1, batterEntry.rosterSlot)]!.recordLine
    expect(batter.battingAverage).toBe(Math.trunc((hits! * 1000) / atBats!))
    expect(batter.homeRuns).toBe(homeRuns)
    expect(batter.runsBattedIn).toBe(runsBattedIn)
  })

  it('마투수는 기록표에 칸이 없어도 XlsACE_PIT 행의 줄 — 게이트가 마선수를 늘 거른다', () => {
    const started = startTeamGame({ ...기본옵션, acePitcherId: 1 }, createSeededRandom(1))
    const aceSlot = started.ourPitcherEntry.findIndex((pitcher) => pitcher.aceIndex >= 0)
    const { pitcher } = teamMatchupCardsOf({ ...started, ourPitcherIndex: aceSlot }, { stats: { batters: {}, pitchers: {} }, countsThisGame: true })
    const ace = ACE_PITCHERS[1]!
    expect(pitcher.earnedRunAverage).toBe(Math.trunc((ace.recordLine[1]! * 2700) / ace.recordLine[0]!))
    expect(pitcher.strikeouts).toBe(ace.recordLine[3])
  })
})

describe('사람 수비 장면의 마운드 그림 — 타석 교대 0x47cc8 (0x482fc · 48138~4816a)', () => {
  it('붙박이 투수는 레코드 +0x19 · +0x1a 니블 − 1 로 장비 겹(0x79790)을 싣는다 — 외인구단(팀 14)은 제구 니블 3 → 모자 등급 2', () => {
    const progress = startTeamGame({ ...기본옵션, ourTeamId: 14 }, createSeededRandom(1))
    const stage = teamPitcherSideStageOf(progress)
    expect(stage.acePitcher).toBeNull()
    expect(stage.pitcherEquipment).toEqual({ head: 2, hand: -1, body: -1, leg: -1 })
  })

  it('마투수가 마운드에 서면 적재 0x793b0 이 ace/pitcher_* 를 싣고 장비 겹은 없다', () => {
    const started = startTeamGame({ ...기본옵션, acePitcherId: 1 }, createSeededRandom(1))
    const aceSlot = started.ourPitcherEntry.findIndex((pitcher) => pitcher.aceIndex >= 0)
    const stage = teamPitcherSideStageOf({ ...started, ourPitcherIndex: aceSlot })
    expect(stage.acePitcher?.framesUrl).toBe(ACE_PITCHERS[1]!.framesUrl)
    expect(stage.pitcherEquipment).toBeUndefined()
  })
})

describe('사람 타석 마운드의 상대 투수 장비 겹 — 타석 교대 0x47cc8 의 48138~4816a (모드 무관)', () => {
  it('상대가 외인구단(팀 14)이면 선발 레코드의 니블(제구 3)을 넘긴다 — 모자 등급 2', () => {
    const progress = startTeamGame({ ...기본옵션, opponentTeamId: 14 }, createSeededRandom(1))
    const nibbles = currentPitcherEquipment(progress)
    expect(nibbles).toEqual([3, 0, 0, 0])
    expect(pitcherEquipmentOfNibbles(nibbles)).toEqual({ head: 2, hand: -1, body: -1, leg: -1 })
  })

  it('시즌 CPU 명단 니블(새 해 CPU 장비 0x665e8 이 쓴 레코드 +0x19 · +0x1a)이 있으면 그 값', () => {
    const batters = Array.from({ length: 12 }, (_, rosterSlot) => ({ rosterSlot, position: rosterSlot < 9 ? rosterSlot + 1 : 0 }))
    const pitchers = [{ tableSlot: 0, equipment: [0, 5, 0, 9] }, 1, 2, 3, 4, 5, 6, 7]
    const progress = startTeamGame({ ...기본옵션, opponentEntryOrder: { batters, pitchers } }, createSeededRandom(1))
    const nibbles = currentPitcherEquipment(progress)
    expect(nibbles).toEqual(progress.opponentPitcherEntry[progress.opponentPitcherIndex]!.equipment)
    expect(progress.opponentPitcherIndex).toBe(0)
    expect(nibbles).toEqual([0, 5, 0, 9])
  })

  it('리그 열 팀은 니블이 모두 0 — 맨몸', () => {
    const progress = startTeamGame(기본옵션, createSeededRandom(1))
    expect(pitcherEquipmentOfNibbles(currentPitcherEquipment(progress))).toEqual({ head: -1, hand: -1, body: -1, leg: -1 })
  })

  it('상대 마투수가 마운드에 서면 니블을 안 넘긴다 (0x4806e 0xb633c 참 → 0x793b0 의 ace/pitcher_*)', () => {
    const started = startTeamGame({ ...기본옵션, opponentTeamId: 14 }, createSeededRandom(1))
    // 0xb88c8 → 0xb521c 의 0x60 가지 — 상대 명단 8번 칸에 마투수
    const opponentPitcherEntry = withAcePitcher(started.opponentPitcherEntry, 1)
    const aceSlot = opponentPitcherEntry.findIndex((pitcher) => pitcher.aceIndex >= 0)
    expect(aceSlot).toBeGreaterThanOrEqual(0)
    expect(currentPitcherEquipment({ ...started, opponentPitcherEntry, opponentPitcherIndex: aceSlot })).toBeUndefined()
  })
})

describe('사람 타석 타자 폼 · 피부 · 손 — 타석 교대 0x47d58~0x47dd6 (팀 경기도 넘긴다)', () => {
  it('붙박이 표 타자는 Xls 행 +0xb — 폼 >> 4 · 피부 (>> 2) & 3 · 손 = 폼 & 1', () => {
    const started = startTeamGame(기본옵션, createSeededRandom(1))
    const at = (battingOrderIndex: number) => teamBattingStageBatterOf({ ...started, game: { ...started.game, battingOrderIndex } })
    const 칸 = started.ourEntry.findIndex((batter) => batter.rosterSlot === 3)
    // 팀 0 의 칸 3 = +0xb 0x34 → 폼 3(장타형 · 좌타) · 피부 1
    expect(at(칸)).toEqual({ batterForm: 3, batterSkinIndex: 1, batterHand: 1 })
  })

  it('마타자는 XlsACE_BAT +0xb 의 폼과 손 표 0xd88b0 — 메디카는 폼 4(낮은 비트 0)인데 좌타(1)', () => {
    const started = startTeamGame(기본옵션, createSeededRandom(1))
    const ourEntry = withAceBatter(started.ourEntry, 0)
    const aceSlot = ourEntry.findIndex((batter) => batter.aceIndex === 0)
    const stage = teamBattingStageBatterOf({ ...started, ourEntry, game: { ...started.game, battingOrderIndex: aceSlot } })
    expect(stage).toEqual({ batterForm: 4, batterSkinIndex: 0, batterHand: 1 })
  })

  it('기록으로 선 영입 타자는 기록 사본의 +0xb', () => {
    const started = startTeamGame(기본옵션, createSeededRandom(1))
    const ourEntry = started.ourEntry.map((batter, index) =>
      index === 0 ? { ...batter, rosterSlot: NO_ROSTER_SLOT, recordId: 0xfe, profile: 0x34 } : batter,
    )
    const stage = teamBattingStageBatterOf({ ...started, ourEntry, game: { ...started.game, battingOrderIndex: 0 } })
    expect(stage).toEqual({ batterForm: 3, batterSkinIndex: 1, batterHand: 1 })
  })
})

describe('사람 수비 장면의 상대 타자 장비 겹 — 타석 교대 0x47cc8 47e80~47eb6 → 0x78fd8 (모드 무관)', () => {
  it('지금 상대 타자 명단 칸의 니블(히트 · 파워 · 주루)로 장비 겹을 싣는다 — 시즌 CPU 명단 니블이 있으면 그 값', () => {
    const batters = Array.from({ length: 12 }, (_, rosterSlot) => ({
      rosterSlot,
      position: rosterSlot < 9 ? rosterSlot + 1 : 0,
      equipment: [3, 4, 2, 5],
    }))
    const progress = startTeamGame({ ...기본옵션, opponentEntryOrder: { batters, pitchers: [0, 1, 2, 3, 4, 5, 6, 7] } }, createSeededRandom(1))
    const batter = progress.opponentEntry[progress.opponentOrderIndex]!
    expect(batter.aceIndex).toBeLessThan(0)
    expect(teamPitcherSideStageOf(progress).batterEquipment).toEqual(batterEquipmentOf({ hit: 3, power: 4, run: 5 }))
    // 로딩 판이 받는 상대 명단 재료 — 마타자는 뺀다
    const records = opponentBatterRecordsOf(progress.options.opponentTeamId, progress.opponentEntry)
    expect(records.length).toBe(progress.opponentEntry.filter((entry) => entry.aceIndex < 0).length)
    expect(records.every((record) => record.equipment?.join() === '3,4,2,5')).toBe(true)
  })

  it('마타자가 타석에 서면 장비 겹이 없다 (0xb63a0 ≥ 0 이면 47e80 갈래를 안 탄다)', () => {
    const started = startTeamGame(기본옵션, createSeededRandom(1))
    const aceEntry = withAceBatter(started.opponentEntry, 0)
    const aceSlot = aceEntry.findIndex((entry) => entry.aceIndex >= 0)
    const stage = teamPitcherSideStageOf({ ...started, opponentEntry: aceEntry, opponentOrderIndex: aceSlot })
    expect(stage.aceBatterOrder).toBe(0)
    expect(stage.batterEquipment).toBeUndefined()
  })
})

describe('경기 시작 인트로 배경의 타자 손 — 0x3b084 3b0f2 0xae89d(팀[st[9]]) → 0xb63c1', () => {
  it('새 경기는 1회초 측 0 의 1번 타자 손이다 (팀[+0x32] = 0 · st[9] = 0)', () => {
    const progress = startTeamGame(기본옵션, createSeededRandom(1))
    const first = progress.opponentEntry[0]!
    expect(teamIntroBatterHandOf(progress)).toBe(teamBatterHandOf(기본옵션.opponentTeamId, first))
  })

  it('이어하기는 되복사한 블록의 지금 공격 팀 · 다음 타자 손이다', () => {
    const progress = startTeamGame(기본옵션, createSeededRandom(1))
    // 후공(우리)의 말 공격 · 타순 칸 4 에서 저장된 경기
    const resumed = { ...progress, game: { ...progress.game, inning: 3, half: '말' as const, battingOrderIndex: 4 } }
    expect(teamIntroBatterHandOf(resumed)).toBe(teamBatterHandOf(기본옵션.ourTeamId, resumed.ourEntry[4]!))
    // 상대 공격이면 상대 타순 칸
    const opponentAtBat = { ...progress, game: { ...progress.game, inning: 5, half: '초' as const }, opponentOrderIndex: 7 }
    expect(teamIntroBatterHandOf(opponentAtBat)).toBe(teamBatterHandOf(기본옵션.opponentTeamId, opponentAtBat.opponentEntry[7]!))
  })
})
