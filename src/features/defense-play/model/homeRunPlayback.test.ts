import { describe, expect, it } from 'vitest'
import { battedBallTrajectory, clearedFence } from '@/entities/batting/model/battedBallFlight'
import { EMPTY_BASES, runnerCountOf, type BaseState } from '@/entities/game/model/baseState'
import { homeRunPlaybackOf } from '@/features/defense-play/model/homeRunPlayback'
import { fixturePatternFor } from '@/features/defense-play/model/representativePattern'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import { runnerFatesWithoutPlay } from '@/features/defense-play/model/runnerFates'

const 만루: BaseState = { first: true, second: true, third: true }

const 재생 = (bases: BaseState = EMPTY_BASES) => {
  const result = homeRunPlaybackOf({ outcome: { kind: '홈런' }, bases })
  if (result === null) throw new Error('홈런 재생이 없다')
  return result
}

describe('패턴 없이 온 홈런의 재생 — 원본 판(runDefensePlay) 그대로', () => {
  it('홈런이 아니면 만들 것이 없다', () => {
    expect(homeRunPlaybackOf({ outcome: { kind: '삼진' }, bases: EMPTY_BASES })).toBeNull()
    expect(homeRunPlaybackOf({ outcome: { kind: '안타', bases: 2 }, bases: EMPTY_BASES })).toBeNull()
    expect(homeRunPlaybackOf({ outcome: { kind: '아웃', detail: '뜬공아웃' }, bases: EMPTY_BASES })).toBeNull()
  })

  it('결과에 맞는 원본 패턴으로 같은 판을 돌린 것과 한 톨도 다르지 않다 — 근사 구보가 없다', () => {
    for (const bases of [EMPTY_BASES, { first: true, second: false, third: false }, 만루]) {
      const 판 = runDefensePlay({
        outcome: { kind: '홈런' },
        outcomeIsGiven: true,
        trajectory: battedBallTrajectory(fixturePatternFor({ kind: '홈런' })),
        bases,
        outs: 0,
        defenseIsCpu: true,
      })
      expect(재생(bases).ticks).toEqual(판.ticks)
    }
  })

  it('판 끝 정산이 홈런을 내고 점수 · 루 · 아웃 · 주자 운명이 타석 쪽 규칙(전원 득점)과 같다', () => {
    for (const bases of [EMPTY_BASES, { first: true, second: false, third: false }, 만루]) {
      for (const outs of [0, 2]) {
        const play = homeRunPlaybackOf({ outcome: { kind: '홈런' }, bases, outs })
        if (play === null) throw new Error('홈런 재생이 없다')
        expect(play.outcome).toEqual({ kind: '홈런' })
        expect(play.advance).toEqual({ bases: EMPTY_BASES, runsScored: runnerCountOf(bases) + 1, outsAdded: 0 })
        expect(play.voidedRuns).toBe(0)
        expect(play.runnerFates).toEqual(runnerFatesWithoutPlay(bases, { kind: '홈런' }))
      }
    }
  })

  it('공은 원본 궤적을 따라 담장을 넘고, 판은 주자가 모두 홈을 밟은 틱에 닫힌다 (관문 b0e04)', () => {
    const 궤적 = battedBallTrajectory(fixturePatternFor({ kind: '홈런' }))
    expect(clearedFence(궤적)).toBe(true)
    const play = 재생()
    for (let tick = 0; tick <= 궤적.fenceTick; tick += 1) {
      const 점 = 궤적.pointAt(tick)
      expect({ x: play.ticks[tick].ball.x, z: play.ticks[tick].ball.z }).toEqual({ x: 점.x, z: 점.z })
    }
    // 마지막 틱이 타자주자가 홈을 밟은 틱이다 — 그 틱 끝 관문이 닫는다(스냅샷은 틱 머리의 그림이라 한 걸음 앞이다)
    expect(play.log.at(-1)).toBe(`${play.ticks.length - 1}틱 0번 주자 홈 — 보류 0 / 득점 1`)
  })

  it('주자는 타자주자를 포함해 모두 홈까지 돈다', () => {
    for (const [bases, 인원] of [
      [EMPTY_BASES, 1],
      [{ first: true, second: false, third: false }, 2],
      [만루, 4],
    ] as const) {
      const 마지막 = 재생(bases).ticks.at(-1)
      expect(마지막?.runners).toHaveLength(인원)
    }
  })

  it('난수를 안 쓴다 — 아무도 잡지 못한다', () => {
    const play = 재생()
    expect(play.fumbled).toBe(false)
    expect(play.caughtOnTheFly).toBe(false)
    expect(play.throwBase).toBe(-1)
  })
})

/** 홈런 재생도 같은 화면 스냅샷을 쓴다 — 팀 색·마선수 그림이 빠져 있었다 (C-1 · C-16 · R3 7-3) */
describe('홈런 재생 화면 — 팀 팔레트와 마선수 그림', () => {
  it('안 넘기면 지금까지와 똑같다 — 구운 색·보통 수비수 그림', () => {
    const 첫틱 = 재생().ticks[0]

    expect(첫틱.fielders.every((야수) => 야수.teamIndex === null)).toBe(true)
    expect(첫틱.runners.every((주자) => 주자.teamIndex === null)).toBe(true)
    expect(첫틱.fielders.every((야수) => 야수.aceIndex === null)).toBe(true)
  })

  it('팀 번호를 넘기면 야수·주자가 제 팀 색을 탄다', () => {
    const result = homeRunPlaybackOf({
      outcome: { kind: '홈런' },
      bases: 만루,
      defenseTeamIndex: 4,
      offenseTeamIndex: 11,
    })
    if (result === null) throw new Error('홈런 재생이 없다')

    expect(result.ticks[0].fielders.every((야수) => 야수.teamIndex === 4)).toBe(true)
    expect(result.ticks[0].runners.every((주자) => 주자.teamIndex === 11)).toBe(true)
    // 마지막 틱까지 계속 칠한다
    const 마지막 = result.ticks[result.ticks.length - 1]
    expect(마지막.fielders.every((야수) => 야수.teamIndex === 4)).toBe(true)
  })

  it('타자 마선수가 둘이면 둘째도 첫째 그림으로 나온다 — 원본 버그 그대로 (R3 7-3)', () => {
    const result = homeRunPlaybackOf({
      outcome: { kind: '홈런' },
      bases: EMPTY_BASES,
      // 칸 0 투수 마선수 3 · 칸 2 타자 마선수 1 · 칸 6 타자 마선수 4
      aceIndexes: [3, null, 1, null, null, null, 4, null, null],
    })
    if (result === null) throw new Error('홈런 재생이 없다')

    const 첫틱 = result.ticks[0]
    // 투수 칸은 제 표(0xd4008)라 그대로, 타자 마선수 칸은 첫째(1)로 뭉개진다
    expect(첫틱.fielders[0].aceIndex).toBe(3)
    expect(첫틱.fielders[2].aceIndex).toBe(1)
    expect(첫틱.fielders[6].aceIndex).toBe(1)
    expect(첫틱.fielders[5].aceIndex).toBeNull()
  })

  it('홈런 재생에는 레이저 반짝임이 없다 — 공을 쥔 야수가 없다', () => {
    expect(재생().ticks.every((틱) => 틱.laserShiningSlot === null)).toBe(true)
  })
})
