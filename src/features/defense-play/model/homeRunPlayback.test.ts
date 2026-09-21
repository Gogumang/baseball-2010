import { describe, expect, it } from 'vitest'
import { battedBallTrajectory, clearedFence } from '@/entities/batting/model/battedBallFlight'
import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { EMPTY_BASES, type BaseState } from '@/entities/game/model/baseState'
import { homeRunPlaybackOf } from '@/features/defense-play/model/homeRunPlayback'
import { representativePatternOf } from '@/features/defense-play/model/representativePattern'

const 만루: BaseState = { first: true, second: true, third: true }

const 재생 = (bases: BaseState = EMPTY_BASES) => {
  const result = homeRunPlaybackOf({ outcome: { kind: '홈런' }, bases })
  if (result === null) throw new Error('홈런 재생이 없다')
  return result
}

describe('홈런 비행 재생', () => {
  it('홈런이 아니면 만들 것이 없다', () => {
    expect(homeRunPlaybackOf({ outcome: { kind: '삼진' }, bases: EMPTY_BASES })).toBeNull()
    expect(homeRunPlaybackOf({ outcome: { kind: '안타', bases: 2 }, bases: EMPTY_BASES })).toBeNull()
    expect(homeRunPlaybackOf({ outcome: { kind: '아웃', detail: '뜬공아웃' }, bases: EMPTY_BASES })).toBeNull()
  })

  it('홈런은 0틱이 아니다 — 공이 날아가는 그림이 나온다', () => {
    expect(재생().ticks.length).toBeGreaterThan(0)
  })

  it('틱 수가 다른 타구와 비슷한 범위(40~80틱)에 있다', () => {
    for (const bases of [EMPTY_BASES, { first: true, second: false, third: false }, 만루]) {
      const 틱수 = 재생(bases).ticks.length
      expect(틱수).toBeGreaterThanOrEqual(40)
      expect(틱수).toBeLessThanOrEqual(80)
    }
  })

  it('공은 담장을 넘어간 자리까지 궤적을 따라간다', () => {
    const 궤적 = battedBallTrajectory(representativePatternOf({ kind: '홈런' }))
    expect(clearedFence(궤적)).toBe(true)
    const play = 재생()
    for (let tick = 0; tick <= 궤적.fenceTick; tick += 1) {
      const 점 = 궤적.pointAt(tick)
      expect(play.ticks[tick].ball).toEqual({ x: 점.x, z: 점.z, height: 점.y, isFlying: true })
    }
    // 넘어간 뒤에는 그 자리에 머문다 (원본도 궤적 점 목록이 담장 틱에서 끝난다)
    const 마지막 = play.ticks[play.ticks.length - 1].ball
    const 담장점 = 궤적.pointAt(궤적.fenceTick)
    expect({ x: 마지막.x, z: 마지막.z }).toEqual({ x: 담장점.x, z: 담장점.z })
  })

  it('주자는 타자주자를 포함해 모두 홈까지 돈다', () => {
    for (const [bases, 인원] of [
      [EMPTY_BASES, 1],
      [{ first: true, second: false, third: false }, 2],
      [만루, 4],
    ] as const) {
      const play = 재생(bases)
      const 마지막 = play.ticks[play.ticks.length - 1]
      expect(마지막.runners).toHaveLength(인원)
      for (const runner of 마지막.runners) {
        expect(runner.base).toBe(0)
        expect({ x: runner.x, z: runner.z }).toEqual({ x: basePosition(0).x, z: basePosition(0).z })
      }
    }
  })

  it('야수는 공을 쫓지만 절대 잡지 못한다', () => {
    const play = 재생()
    expect(play.catchTick).toBe(-1)
    expect(play.isUncatchable).toBe(true)
    expect(play.throwBase).toBe(-1)
    const 쫓는칸 = play.catchFielderSlot
    const 처음 = play.ticks[0].fielders[쫓는칸]
    const 마지막틱 = play.ticks[play.ticks.length - 1]
    const 마지막 = 마지막틱.fielders[쫓는칸]
    // 공 쪽으로 움직이기는 했다
    expect({ x: 마지막.x, z: 마지막.z }).not.toEqual({ x: 처음.x, z: 처음.z })
    // 그래도 공에는 닿지 못했다
    expect({ x: 마지막.x, z: 마지막.z }).not.toEqual({ x: 마지막틱.ball.x, z: 마지막틱.ball.z })
  })
})
