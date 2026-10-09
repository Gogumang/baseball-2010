import { describe, expect, it } from 'vitest'
import { MISSIONS } from '@/shared/config/original/missions'
import { applyOutcome, applyPickoff, startMission } from '@/entities/mission/model/missionRun'
import { startPitcherMission } from '@/entities/mission/model/pitcherRun'
import {
  missionBatterSlotOf,
  missionDefenseAbilitiesOf,
  missionPlayAbilitiesOf,
  missionRunAbilitiesOnBaseOf,
  missionRunnerRunAbilitiesOf,
  missionRunnerRunAt,
  missionRunnersOf,
} from '@/entities/mission/model/missionRunners'
import { masterGameAbilityOf, MISSION_ACE_ROSTER_SLOT } from '@/entities/mission/model/missionCpuTeam'
import { battingRecordAt, MISSION_NARI_RECORD } from '@/entities/mission/model/missionGame'
import { teamBatters } from '@/entities/team/model/teamRoster'
import { rosterSlotAt } from '@/entities/game/model/quickLineup'
import type { BaseState } from '@/entities/game/model/baseState'

const slotBack = (cursor: number, back: number) => (((cursor - back) % 9) + 9) % 9
const countOf = (bases: BaseState) => Number(bases.first) + Number(bases.second) + Number(bases.third)

describe('미션 시작 주자 — 0xaae7c aafbc → 0xa9a10 (앞선 찬 루부터 지금 타자 칸에서 거꾸로)', () => {
  it('타자 미션은 사람 칸 팀 타선 — 찬 루마다 앞선 루부터 미션 타자 칸 − 1 · − 2 · − 3', () => {
    const mission = MISSIONS.find((m) => m.side === '타자' && countOf(m.start.runners) >= 2)!
    const run = startMission(mission)
    const cursor = missionBatterSlotOf(run)
    expect(cursor).toBe(run.game.humanBatting.order)
    const filled = ([3, 2, 1] as const).filter((base) =>
      base === 1 ? mission.start.runners.first : base === 2 ? mission.start.runners.second : mission.start.runners.third,
    )
    const runners = missionRunnersOf(run)
    filled.forEach((base, index) => {
      expect(base === 1 ? runners.first : base === 2 ? runners.second : runners.third).toBe(slotBack(cursor, index + 1))
    })
    expect(run.runners).toEqual(runners)
  })

  it('투수 미션은 CPU 공격 타선 — 마타자는 지금 타자 칸에 끼워 주자가 아니다', () => {
    const mission = MISSIONS.find((m) => m.side === '투수' && countOf(m.start.runners) >= 1)!
    const run = startPitcherMission(mission)
    const cursor = missionBatterSlotOf(run)
    expect(cursor).toBe(run.cpu.batting?.order)
    const runners = missionRunnersOf(run)
    const leadBase = mission.start.runners.third ? runners.third : mission.start.runners.second ? runners.second : runners.first
    expect(leadBase).toBe(slotBack(cursor, 1))
  })
})

describe('미션 주자 주력 — 0xb570d(ctx, 3, 주자, 1, 90, 1)', () => {
  it('마스터 줄은 0xb6415(선수, 3, 1), 미션 타자 · 마타자 칸은 넘긴 값', () => {
    const mission = MISSIONS.find((m) => m.side === '타자')!
    const run = startMission(mission)
    const batting = run.game.humanBatting
    for (let slot = 0; slot < 9; slot += 1) {
      const row = battingRecordAt(batting, slot)
      const expected =
        row === MISSION_NARI_RECORD ? 777 : masterGameAbilityOf(teamBatters(batting.teamId)[row]!, false, 3)
      expect(missionRunnerRunAt(run, slot, { missionBatterRun: 777 })).toBe(expected)
    }
    const pitcherMission = MISSIONS.find((m) => m.side === '투수' && m.opponentAce > 0)!
    const pitcherRun = startPitcherMission(pitcherMission)
    const batting2 = pitcherRun.cpu.batting!
    const aceSlot = batting2.order
    expect(batting2.records[rosterSlotAt(batting2.lineup, aceSlot)]).toBe(MISSION_ACE_ROSTER_SLOT)
    expect(missionRunnerRunAt(pitcherRun, aceSlot, { aceBatterRun: 321 })).toBe(321)
  })

  it('루별 주력 · HUD 주루 칸은 신원대로 — 0 은 지금 타자', () => {
    const mission = MISSIONS.find((m) => m.side === '타자' && m.start.runners.first)!
    const run = { ...startMission(mission), runners: { first: 4, second: null, third: null }, bases: { first: true, second: false, third: false } }
    const runs = missionRunAbilitiesOnBaseOf(run, { missionBatterRun: 900 })
    expect(runs[1]).toBe(missionRunnerRunAt(run, 4, { missionBatterRun: 900 }))
    expect(runs[0]).toBe(missionRunnerRunAt(run, run.game.humanBatting.order, { missionBatterRun: 900 }))
    expect(missionRunnerRunAbilitiesOf(run, { missionBatterRun: 900 })).toEqual({ first: runs[1] })
  })
})

describe('미션 주자 신원을 판마다 민다', () => {
  it('볼넷은 타자가 0번에 들고 밀린 주자만 간다 — 타자 칸은 판 앞 타순', () => {
    const mission = MISSIONS.find((m) => m.side === '타자')!
    const start = startMission(mission)
    const run = { ...start, bases: { first: true, second: false, third: false }, runners: { first: 5, second: null, third: null }, outs: 0 }
    const batter = run.game.humanBatting.order
    const after = applyOutcome(run, { kind: '볼넷' })
    expect(after.runners).toEqual({ first: batter, second: 5, third: null })
  })

  it('주자 판(견제 · 도루)은 판의 살아남은 주자로 — 1루 주자가 2루로 가면 신원도 따라간다', () => {
    const mission = MISSIONS.find((m) => m.side === '타자')!
    const start = startMission(mission)
    const run = { ...start, bases: { first: true, second: false, third: false }, runners: { first: 2, second: null, third: null }, outs: 0 }
    const moved = applyPickoff(run, { bases: { first: false, second: true, third: false }, runsScored: 0, outsAdded: 0 }, [
      { fromBase: 1, scored: false, retired: false },
    ])
    expect(moved.runners).toEqual({ first: null, second: 2, third: null })
  })
})

describe('자동진행이 미션 타자 앞에서 멈추면 간이 엔진이 세운 주자 신원을 이어받는다', () => {
  it('멈춘 루와 신원이 맞고 신원은 타순 칸(0~8)이다', async () => {
    const { runBatterMissionAutoHalves } = await import('@/entities/mission/model/missionRun')
    const { runnersFitBases } = await import('@/entities/game/model/baseRunners')
    const { createSeededRandom } = await import('@/shared/api/random/seededRandom')
    const mission = MISSIONS.find((m) => m.side === '타자')!
    let found = 0
    for (let seed = 1; seed <= 40 && found < 3; seed += 1) {
      const random = createSeededRandom(seed)
      const ended = { ...startMission(mission), bases: { first: false, second: false, third: false }, outs: 0 }
      // 미션 타자 바로 뒤 타순부터 — 사람 칸 반 이닝이 한 바퀴 가까이 돌다 미션 타자 앞에서 멈춘다
      const humanBatting = { ...ended.game.humanBatting, order: (ended.game.humanBatting.order + 1) % 9 }
      const run = runBatterMissionAutoHalves({ ...ended, game: { ...ended.game, humanBatting, halfEnded: true } }, random)
      if (run.status !== '진행중' || countOf(run.bases) === 0) continue
      found += 1
      expect(runnersFitBases(run.runners, run.bases)).toBe(true)
      for (const runner of [run.runners?.first, run.runners?.second, run.runners?.third]) {
        if (runner !== null && runner !== undefined) expect(runner >= 0 && runner < 9).toBe(true)
      }
    }
    expect(found).toBeGreaterThan(0)
  })
})

describe('미션 수비 판 아홉 칸 수비 — 0xb0fb4 (수비 팀 레코드의 자리 니블 − 1 칸, 0xb570c(팀, 2, 선수, 90, 1))', () => {
  const expectedOf = (teamId: number) => {
    const abilities = Array.from({ length: 9 }, () => 500)
    teamBatters(teamId).forEach((player) => {
      const slot = ((player.position ?? 0) & 0xf) - 1
      if (slot >= 1 && slot < 9) abilities[slot] = masterGameAbilityOf(player, false, 2)
    })
    return abilities
  }

  it('타자 미션은 CPU 팀(수비) 마스터 줄 — 칸 0(투수)은 원본이 선수를 안 찾아 진행기 기본값', () => {
    const mission = MISSIONS.find((m) => m.side === '타자')!
    const run = startMission(mission)
    const cpuTeamId = run.game.cpuAutoBatting!.teamId
    const abilities = missionDefenseAbilitiesOf(run)
    expect(abilities).toEqual(expectedOf(cpuTeamId))
    expect(abilities[0]).toBe(500)
  })

  it('투수 미션은 사람 칸 팀(수비) 마스터 줄', () => {
    const mission = MISSIONS.find((m) => m.side === '투수')!
    const run = startPitcherMission(mission)
    expect(missionDefenseAbilitiesOf(run)).toEqual(expectedOf(run.game.humanBatting.teamId))
  })

  it('대타가 들어선 타순 칸은 새 타자가 옛 타자의 자리를 받는다 (0xaebe4 aecac~ — 자리 니블 맞바꿈)', () => {
    const mission = MISSIONS.find((m) => m.side === '투수')!
    const run = startPitcherMission(mission)
    const batting = run.game.humanBatting
    const roster = teamBatters(batting.teamId)
    // 타순 칸 0 의 선수를 벤치 레코드 9 로 바꾼다
    const rosterSlots = [...batting.lineup.rosterSlots]
    rosterSlots[0] = 9
    rosterSlots[9] = 0
    const swapped = { ...run, game: { ...run.game, humanBatting: { ...batting, lineup: { ...batting.lineup, rosterSlots } } } }
    const slot = ((roster[0]!.position ?? 0) & 0xf) - 1
    const abilities = missionDefenseAbilitiesOf(swapped)
    if (slot >= 1) expect(abilities[slot]).toBe(masterGameAbilityOf(roster[9]!, false, 2))
    // 나머지 칸은 그대로
    expect(abilities.filter((_v, index) => index !== slot)).toEqual(
      expectedOf(batting.teamId).filter((_v, index) => index !== slot),
    )
  })

  it('수비 판 능력치 한 벌 — 루별 주루는 주자 신원대로', () => {
    const mission = MISSIONS.find((m) => m.side === '타자' && countOf(m.start.runners) >= 1)!
    const run = startMission(mission)
    const abilities = missionPlayAbilitiesOf(run)
    expect(abilities.runAbilities).toEqual(missionRunAbilitiesOnBaseOf(run))
    expect(abilities.defenseAbilities).toEqual(missionDefenseAbilitiesOf(run))
  })
})
