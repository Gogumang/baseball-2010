import { describe, expect, it } from 'vitest'
import { MISSIONS } from '@/shared/config/original/missions'
import { applyOutcome, startMission } from '@/entities/mission/model/missionRun'
import { startPitcherMission } from '@/entities/mission/model/pitcherRun'
import { MISSION_CPU_START } from '@/entities/mission/model/missionCpuTeam'
import { missionOpponentOf } from '@/entities/game/model/aceOpponent'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import {
  missionBatterMatchupCardsOf,
  missionPitcherMatchupCardsOf,
} from '@/pages/mission-play/lib/missionMatchupCards'

const missionOf = (side: '타자' | '투수', id: number) => MISSIONS.find((m) => m.side === side && m.id === id)!
const cpuTeamOf = (mission: ReturnType<typeof missionOf>) => mission.sideTeams[mission.humanSide === 0 ? 1 : 0]
const humanTeamOf = (mission: ReturnType<typeof missionOf>) => mission.sideTeams[mission.humanSide]

/** 미션 타자 — 타수 100 · 안타 30 · 홈런 5 · 타점 20 */
const 나리타자 = { name: '나리타자', hand: 1, recordLine: [100, 30, 4, 1, 5, 20] }
/** 미션 투수 — 아웃 90 · 실점 10 · 탈삼진 25 */
const 나리투수 = { name: '나리투수', role: 0, form: 3, staminaAbility: 500, stamina: 10000, recordLine: [90, 10, 0, 25, 400, 3] }

describe('미션 소개 판 0x44944 — 타자 미션(모드 6)', () => {
  it('타자 1 — COM 마운드는 0xb8c94 가 세운 선발 마스터 줄: Xls 행 줄(+0x20 아웃 · +0x22 실점 · +0x26 탈삼진)의 방어율 · 삼진', () => {
    const mission = missionOf('타자', 1)
    const cards = missionBatterMatchupCardsOf(startMission(mission, { nariRecordSlot: 3 }), 나리타자)
    const row = teamPitchers(cpuTeamOf(mission))[MISSION_CPU_START['타자:1']!.pitcherSlot]!
    const [outs, runs, , strikeouts] = row.recordLine
    expect(cards.pitcher).toMatchObject({
      isComputer: true,
      name: row.name,
      role: row.profile & 3,
      earnedRunAverage: Math.min(9999, Math.trunc((runs! * 2700) / outs!)),
      strikeouts,
    })
    expect(cards.pitcher.stamina).toBeDefined()
  })

  it('미션 타자 차례 — PLAYER · 기록 줄 + 이 경기 줄(게이트 0xa5764 는 나리 · 명예만) · 수비는 마스터 줄 k 의 것', () => {
    const mission = missionOf('타자', 1)
    const run = startMission(mission, { nariRecordSlot: 3 })
    const cards = missionBatterMatchupCardsOf(run, 나리타자)
    expect(cards.batterHand).toBe(1)
    expect(cards.batter).toMatchObject({
      isComputer: false,
      name: '나리타자',
      battingAverage: 300,
      homeRuns: 5,
      runsBattedIn: 20,
      position: teamBatters(humanTeamOf(mission))[3]!.position,
      recentResults: [],
    })
    // 홈런 하나 — 타수 · 안타 · 홈런 +1, 타점 += 그 판 득점 (지금 타자 칸만 판 앞으로 되돌려 미션 타자 판을 다시 본다)
    const after = applyOutcome(run, { kind: '홈런' })
    const again = missionBatterMatchupCardsOf({ ...run, progress: after.progress }, 나리타자)
    const runs = after.progress.counts['타점'] ?? 0
    expect(again.batter).toMatchObject({
      battingAverage: Math.trunc((31 * 1000) / 101),
      homeRuns: 6,
      runsBattedIn: 20 + runs,
    })
  })

  it('미션 타자 뒤 마스터 타순 — 그 줄의 표값 그대로(게이트 거짓) · 오늘 타석 링은 그 타순 칸', () => {
    const mission = missionOf('타자', 1)
    const after = applyOutcome(startMission(mission, { nariRecordSlot: 3 }), { kind: '삼진' })
    const cards = missionBatterMatchupCardsOf(after, 나리타자)
    const batting = after.game.humanBatting
    const row = teamBatters(batting.teamId)[batting.records[batting.lineup.rosterSlots[batting.order % 9]!]!]!
    const [atBats, hits, , , homeRuns, runsBattedIn] = row.recordLine
    expect(cards.batter).toMatchObject({
      isComputer: false,
      name: row.name,
      battingAverage: Math.min(1000, Math.trunc((hits! * 1000) / atBats!)),
      homeRuns,
      runsBattedIn,
      battingOrder: batting.order % 9,
    })
  })

  it('기록 줄을 모르는 미션 타자(옛 명전 기록)는 줄 칸을 비운다 · k 를 모르면 수비도 비운다', () => {
    const cards = missionBatterMatchupCardsOf(startMission(missionOf('타자', 1)), { name: '옛명전', hand: 0 })
    expect(cards.batter.battingAverage).toBeUndefined()
    expect(cards.batter.position).toBeUndefined()
    expect(cards.batter.name).toBe('옛명전')
  })

  it('타자 12 — 마투수 드래고나: XlsACE_PIT 행 줄 · 보직 2 · 손 0xb63c0 마투수 표', () => {
    const mission = missionOf('타자', 12)
    const cards = missionBatterMatchupCardsOf(startMission(mission), 나리타자)
    const ace = missionOpponentOf('투수', mission.opponentAce)!
    expect(cards.pitcher).toMatchObject({
      isComputer: true,
      name: ace.name,
      role: 2,
      earnedRunAverage: Math.trunc((ace.recordLine[1]! * 2700) / ace.recordLine[0]!),
      strikeouts: ace.recordLine[3],
    })
  })
})

describe('미션 소개 판 0x44944 — 투수 미션(모드 5)', () => {
  it('투수 1 — PLAYER 미션 투수(줄 + 이 경기 줄) · COM 타자는 지금 타순 마스터 줄의 Xls 줄', () => {
    const mission = missionOf('투수', 1)
    const run = startPitcherMission(mission)
    const cards = missionPitcherMatchupCardsOf(run, 나리투수)
    expect(cards.pitcher).toMatchObject({
      isComputer: false,
      name: '나리투수',
      role: 0,
      throwsLeft: true,
      earnedRunAverage: 300,
      strikeouts: 25,
    })
    const order = MISSION_CPU_START['투수:1']!.battingOrder
    const row = teamBatters(cpuTeamOf(mission))[order]!
    expect(cards.batter).toMatchObject({
      isComputer: true,
      name: row.name,
      battingOrder: order,
      homeRuns: row.recordLine[4],
      runsBattedIn: row.recordLine[5],
    })
    // 이 경기 — 아웃(R+0x13c 와 같은 콜) · 실점 · 탈삼진
    const played = {
      ...run,
      progress: { ...run.progress, counts: { 아웃: 3, 탈삼진: 2 } },
      allowed: { ...run.allowed, runs: 1 },
    }
    expect(missionPitcherMatchupCardsOf(played, 나리투수).pitcher).toMatchObject({
      earnedRunAverage: Math.trunc((11 * 2700) / 93),
      strikeouts: 27,
    })
  })

  it('투수 12 — 지금 타순에 끼운 마타자: XlsACE_BAT 행 줄 · 손 표 0xd88b0', () => {
    const mission = missionOf('투수', 12)
    const cards = missionPitcherMatchupCardsOf(startPitcherMission(mission), 나리투수)
    const ace = missionOpponentOf('타자', mission.opponentAce)!
    expect(cards.batter).toMatchObject({
      isComputer: true,
      name: ace.name,
      battingAverage: Math.trunc((ace.recordLine[1]! * 1000) / ace.recordLine[0]!),
      homeRuns: ace.recordLine[4],
      runsBattedIn: ace.recordLine[5],
    })
  })
})
