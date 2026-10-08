import { describe, expect, it } from 'vitest'
import { MISSIONS } from '@/shared/config/original/missions'
import { startMission } from '@/entities/mission/model/missionRun'
import { startPitcherMission } from '@/entities/mission/model/pitcherRun'
import { MISSION_CPU_START } from '@/entities/mission/model/missionCpuTeam'
import { missionOpponentOf } from '@/entities/game/model/aceOpponent'
import { teamBatters, teamPitchers } from '@/entities/team/model/teamRoster'
import { missionFirstBoardCardsOf } from '@/pages/mission-play/lib/missionFirstBoardCards'

const missionOf = (side: '타자' | '투수', id: number) => MISSIONS.find((m) => m.side === side && m.id === id)!
const 이름 = { missionBatter: '나리타자', missionPitcher: '나리투수' }

describe('미션 첫 0x18 판의 두 팀 판 — 0x420dc PITCHER · 0x42364 DUE UP', () => {
  it('타자 12 "운명의 대결" — 공격 = 사람 칸(말) · 마투수 드래고나가 PITCHER · DUE UP 첫 줄은 미션 타자(시작 타순 3) · 2아웃 점', () => {
    const mission = missionOf('타자', 12)
    const cards = missionFirstBoardCardsOf(startMission(mission), 이름)
    expect(cards.battingSide).toBe(1)
    // 48c86 0xaae7c aaf70~ 가 레코드 +4 를 깐 그대로 (0x3ac90 의 0xb67d0 은 st[4] · st[5] · st[6] 을 안 지운다)
    expect(cards.count).toEqual({ strikes: 0, balls: 0, outs: 2 })
    expect(cards.pitcherName).toBe(missionOpponentOf('투수', 5)!.name)
    expect(cards.currentOrder).toBe(3)
    // 레코드 12(기본 k)에 미션 타자 → 시작 타순 3 ↔ 12 — 4 · 5 번 칸은 마스터 줄 그대로
    expect(cards.dueUpNames).toEqual(['나리타자', teamBatters(1)[4]!.name, teamBatters(1)[5]!.name])
  })

  it('타자 8 "치명적인 유혹" — 시작 카운트 1스트라이크 1아웃이 점으로 남는다', () => {
    const cards = missionFirstBoardCardsOf(startMission(missionOf('타자', 8)), 이름)
    expect(cards.count).toEqual({ strikes: 1, balls: 0, outs: 1 })
    expect(cards.pitcherName).toBe(missionOpponentOf('투수', 4)!.name)
  })

  it('타자 1 — 마투수가 없으면 0xaa57c aa8a0 이 0번에 세운 선발 칸(레코드 +6 아래 4비트)의 마스터 줄', () => {
    const mission = missionOf('타자', 1)
    const cards = missionFirstBoardCardsOf(startMission(mission), 이름)
    const cpuTeam = mission.sideTeams[mission.humanSide === 0 ? 1 : 0]
    expect(cards.pitcherName).toBe(teamPitchers(cpuTeam)[MISSION_CPU_START['타자:1']!.pitcherSlot]!.name)
  })

  it('투수 12 — 공격 = CPU 칸 · PITCHER 는 미션 투수 · DUE UP 첫 줄은 0xaae7c 가 지금 타순에 끼운 마타자 · 2볼 1아웃', () => {
    const mission = missionOf('투수', 12)
    const cards = missionFirstBoardCardsOf(startPitcherMission(mission), 이름)
    const cpuSide = mission.humanSide === 0 ? 1 : 0
    const cpuTeam = mission.sideTeams[cpuSide]
    const order = MISSION_CPU_START['투수:12']!.battingOrder
    expect(cards.battingSide).toBe(cpuSide)
    expect(cards.count).toEqual({ strikes: mission.start.strikes, balls: mission.start.balls, outs: mission.start.outs })
    expect(cards.pitcherName).toBe('나리투수')
    expect(cards.currentOrder).toBe(order)
    expect(cards.dueUpNames).toEqual([
      missionOpponentOf('타자', mission.opponentAce)!.name,
      teamBatters(cpuTeam)[(order + 1) % 9]!.name,
      teamBatters(cpuTeam)[(order + 2) % 9]!.name,
    ])
  })

  it('투수 1 — 마타자 없음 · CPU 타순 6 부터 세 줄(9 를 넘으면 mod 9)', () => {
    const mission = missionOf('투수', 1)
    expect(mission.opponentAce).toBe(0)
    const cards = missionFirstBoardCardsOf(startPitcherMission(mission), 이름)
    const cpuTeam = mission.sideTeams[mission.humanSide === 0 ? 1 : 0]
    expect(cards.currentOrder).toBe(6)
    expect(cards.dueUpNames).toEqual([6, 7, 8].map((row) => teamBatters(cpuTeam)[row]!.name))
  })
})
