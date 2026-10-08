import { describe, expect, it } from 'vitest'
import { MISSIONS } from '@/shared/config/original/missions'
import type { OriginalMission } from '@/shared/config/original/missions'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  MISSION_ACE_ROSTER_SLOT,
  MISSION_CPU_START,
  enterMissionPitchSelection,
  isMissionCpuBatterAce,
  isMissionCpuMoundAce,
  missionCpuAfterPitch,
  missionCpuAfterPlateAppearance,
  missionCpuAfterRuns,
  missionCpuAtNewPlateAppearance,
  startMissionCpuTeam,
} from '@/entities/mission/model/missionCpuTeam'
import type { MissionCpuTeam } from '@/entities/mission/model/missionCpuTeam'
import { missionKeyOf } from '@/entities/mission/model/missionGoal'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'

const missionOf = (side: OriginalMission['side'], id: number): OriginalMission => {
  const found = MISSIONS.find((mission) => mission.side === side && mission.id === id)
  if (found === undefined) throw new Error(`${side} ${id}`)
  return found
}

/** 굴리면 안 되는 자리 — 한 번이라도 굴리면 실패 */
const 굴림금지: RandomPort = {
  next: () => {
    throw new Error('굴림이 없어야 한다')
  },
  nextInRange: () => {
    throw new Error('굴림이 없어야 한다')
  },
  pick: () => {
    throw new Error('굴림이 없어야 한다')
  },
}

/** 정해진 값을 차례대로 내주는 난수 — 굴림마다 [최소, 최대] 를 적는다 */
function 정해진난수(values: readonly number[]): RandomPort & { readonly rolls: [number, number][] } {
  const rolls: [number, number][] = []
  let index = 0
  return {
    rolls,
    next: () => 0,
    nextInRange(minimum, maximum) {
      rolls.push([minimum, maximum])
      const value = values[index] ?? 0
      index += 1
      return value
    },
    pick: (candidates) => candidates[0] as never,
  }
}

const 상황 = (mission: OriginalMission) => ({ mission, runnerCount: 0, balls: 0, strikes: 0, aceStamina: FULL_STAMINA })
const 아웃: AtBatOutcome = { kind: '아웃', detail: '땅볼아웃' }

describe('미션 CPU 팀 — 0xaa57c 가 세운 다른 칸 팀 (레코드 +2 · +6 · +7)', () => {
  it('원본 표의 모든 미션에 시작 칸이 있다 (레코드 +6 · +7 아래 4비트)', () => {
    for (const mission of MISSIONS) expect(MISSION_CPU_START[missionKeyOf(mission)]).toBeDefined()
  })

  it('타자 6 은 마무리(마스터 7번)가 선발이다 — 0xb8c94 가 명부 0 ↔ 7 을 맞바꾼다', () => {
    const team = startMissionCpuTeam(missionOf('타자', 6))
    expect(team.pitching?.teamId).toBe(9)
    expect(team.pitching?.roster).toEqual([7, 1, 2, 3, 4, 5, 6, 0])
    expect(team.pitching?.mound).toMatchObject({ pitcherSlot: 0, stamina: FULL_STAMINA, usedSlots: [] })
    expect(team.batting).toBeNull()
  })

  it('마투수 미션(타자 12)은 0xaae7c 가 마투수를 0번에 세운다', () => {
    const team = startMissionCpuTeam(missionOf('타자', 12))
    expect(team.pitching?.teamId).toBe(14)
    expect(team.pitching?.roster[0]).toBe(MISSION_ACE_ROSTER_SLOT)
    expect(isMissionCpuMoundAce(team)).toBe(true)
  })

  it('투수 미션은 CPU 공격 타선 — 타순은 레코드 +7 아래 4비트, 마타자는 그 타순 칸에 선다 (0xb53f0 · 0xb8cb8)', () => {
    const plain = startMissionCpuTeam(missionOf('투수', 2))
    expect(plain.batting?.order).toBe(8)
    expect(plain.batting?.lineup.benchBatters).toBe(3)
    expect(plain.pitching).toBeNull()

    const ace = startMissionCpuTeam(missionOf('투수', 18))
    expect(ace.batting?.order).toBe(3)
    expect(ace.batting?.lineup.rosterSlots.slice(0, 10)).toEqual([0, 1, 2, MISSION_ACE_ROSTER_SLOT, 4, 5, 6, 7, 8, 3])
    expect(isMissionCpuBatterAce(ace)).toBe(true)
  })
})

describe('타자 미션 CPU 투수 교체 — 0xf 진입 0x3d954 → 0xac428 (3da3e)', () => {
  it('이닝 실점 A 가 2 를 넘으면 공마다 묻는 0xac428 이 바꾼다 — 벤치에 마선수가 없어 굴림이 없다', () => {
    const mission = missionOf('타자', 9)
    const scored = missionCpuAfterRuns(startMissionCpuTeam(mission), 3, false)
    expect(scored.pitching).toMatchObject({ inningRunsAllowed: 3, ourRuns: 3, mound: { runsAllowed: 3 } })

    const { team, substitution } = enterMissionPitchSelection(scored, 상황(mission), 굴림금지)
    expect(substitution).toEqual({ kind: '투수교체', incomingIsAce: false })
    expect(team.pitching?.mound.pitcherSlot).not.toBe(0)
    expect(team.pitching?.mound).toMatchObject({ runsAllowed: 0, pitches: 0, usedSlots: [0], justChanged: true })
    expect(team.pitching?.inningRunsAllowed).toBe(0)

    // 0x16 → 0xd → 0xe → 0xf 재진입 — state[0xd] 가 서 있어 다시 안 묻는다
    expect(enterMissionPitchSelection(team, 상황(mission), 굴림금지).substitution).toBeNull()
    // 공 하나(0xa5e14 a5e72)가 내린다
    expect(missionCpuAfterPitch(team, { pitchTypeNumber: 1, batterIntimidates: false }).pitching?.mound.justChanged).toBe(
      false,
    )
  })

  it('2점이면 안 바꾼다 — 3아웃(이닝 교대 0xa5b00)이 A 를 0 으로 되돌린다', () => {
    const mission = missionOf('타자', 9)
    const twoRuns = missionCpuAfterRuns(startMissionCpuTeam(mission), 2, false)
    expect(enterMissionPitchSelection(twoRuns, 상황(mission), 굴림금지).substitution).toBeNull()

    const nextInning = missionCpuAfterRuns(twoRuns, 1, true)
    expect(nextInning.pitching).toMatchObject({ inningRunsAllowed: 0, mound: { runsAllowed: 3 } })
    expect(enterMissionPitchSelection(nextInning, 상황(mission), 굴림금지).substitution).toBeNull()
  })

  it('레오니(타자 4) · 발렌타인(타자 8)은 0x66864 가 막는다 — 미션 객체 +0xbd = 3 · 7', () => {
    for (const id of [4, 8]) {
      const mission = missionOf('타자', id)
      const battered = missionCpuAfterRuns(startMissionCpuTeam(mission), 9, false)
      expect(enterMissionPitchSelection(battered, 상황(mission), 굴림금지).substitution).toBeNull()
    }
  })

  it('드래고나(타자 12)는 막지 않는다 — 마투수는 특수 문턱(체력 ≤ 39%)으로 내려간다', () => {
    const mission = missionOf('타자', 12)
    const team = startMissionCpuTeam(mission)
    expect(enterMissionPitchSelection(team, 상황(mission), 굴림금지).substitution).toBeNull()
    const tired = enterMissionPitchSelection(team, { ...상황(mission), aceStamina: 3900 }, 굴림금지)
    expect(tired.substitution).toEqual({ kind: '투수교체', incomingIsAce: false })
    expect(isMissionCpuMoundAce(tired.team)).toBe(false)
  })

  it('마스터 줄 투수는 공마다 스태미나가 깎인다 (0xa5e14 → 0xaeb08) — 마투수는 세션이 따로 깎는다', () => {
    const plain = startMissionCpuTeam(missionOf('타자', 1))
    const thrown = missionCpuAfterPitch(plain, { pitchTypeNumber: 1, batterIntimidates: false })
    expect(thrown.pitching?.mound.stamina).toBeLessThan(FULL_STAMINA)
    expect(thrown.pitching?.mound.pitches).toBe(1)

    const ace = startMissionCpuTeam(missionOf('타자', 12))
    expect(missionCpuAfterPitch(ace, { pitchTypeNumber: 1, batterIntimidates: false }).pitching?.mound.stamina).toBe(
      FULL_STAMINA,
    )
  })
})

describe('투수 미션 CPU 대타 — 0xf 진입 0x3d954 → 0xac228 (3da70, 가림막 없음)', () => {
  /** 타순 한 바퀴 반 — 같은 칸이 세 번째 타석에 서도록 18 타석을 아웃으로 정산한다 */
  const 두바퀴 = (team: MissionCpuTeam) => {
    let current = team
    for (let index = 0; index < 18; index += 1) current = missionCpuAfterPlateAppearance(current, 아웃)
    return current
  }

  it('타석 둘 미만이면 굴림 없이 지나간다', () => {
    const mission = missionOf('투수', 7)
    const team = startMissionCpuTeam(mission)
    expect(enterMissionPitchSelection(team, 상황(mission), 굴림금지).substitution).toBeNull()
  })

  it('같은 타순 칸이 세 번째 타석에 서면 rand(0,1000) → rand(0, 벤치) 로 바꾸고 state[0xe] 가 막는다', () => {
    const mission = missionOf('투수', 7)
    const team = 두바퀴(startMissionCpuTeam(mission))
    expect(team.batting?.order).toBe(2)
    expect(team.batting?.lineup.records[2]).toMatchObject({ plateAppearances: 2, hits: 0 })

    const random = 정해진난수([99, 1])
    const { team: pinched, substitution } = enterMissionPitchSelection(team, 상황(mission), random)
    expect(random.rolls).toEqual([
      [0, 1000],
      [0, 3],
    ])
    expect(substitution).toEqual({ kind: '대타', incomingIsAce: false })
    expect(pinched.pinchHitBlocked).toBe(true)
    expect(pinched.batting?.lineup.rosterSlots[2]).toBe(10)
    expect(pinched.batting?.lineup.records[2]).toMatchObject({ plateAppearances: 0 })
    expect(pinched.batting?.lineup.benchBatters).toBe(2)

    // 0x16 → 0xd(지우기 건너뜀) → 0xe → 0xf 재진입은 state[0xe] 로 굴림 없이 빠진다
    expect(enterMissionPitchSelection(pinched, 상황(mission), 굴림금지).substitution).toBeNull()
    // 공 하나(a5e7c) · 새 타석 0xd(48eb6)가 내린다
    expect(missionCpuAfterPitch(pinched, { pitchTypeNumber: 1, batterIntimidates: false }).pinchHitBlocked).toBe(false)
    expect(missionCpuAtNewPlateAppearance(pinched).pinchHitBlocked).toBe(false)
  })

  it('굴림이 확률 밖이면 굴림 하나만 쓰고 그대로다 — 볼카운트가 있으면 확률이 >> (볼 + 스트라이크 + 1)', () => {
    const mission = missionOf('투수', 7)
    const team = 두바퀴(startMissionCpuTeam(mission))
    // 주자 없음 100‰ — 1-1 이면 100 >> 3 = 12
    const random = 정해진난수([12])
    const result = enterMissionPitchSelection(team, { ...상황(mission), balls: 1, strikes: 1 }, random)
    expect(random.rolls).toEqual([[0, 1000]])
    expect(result.substitution).toBeNull()
    expect(result.team).toBe(team)
  })

  it('마타자 칸은 굴림 없이 안 바꾼다 (0xae89c → 0xb633c)', () => {
    const mission = missionOf('투수', 18)
    let team = startMissionCpuTeam(mission)
    for (let index = 0; index < 18; index += 1) team = missionCpuAfterPlateAppearance(team, 아웃)
    expect(isMissionCpuBatterAce(team)).toBe(true)
    expect(enterMissionPitchSelection(team, 상황(mission), 굴림금지).substitution).toBeNull()
  })
})
