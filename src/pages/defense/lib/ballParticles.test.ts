import { describe, expect, it } from 'vitest'
import { ballParticleShotsOf, BIG_HIT_BALL_PARTICLE, BOUNCE_BALL_PARTICLE } from '@/pages/defense/lib/ballParticles'
import { toScreenX, toScreenY } from '@/pages/defense/lib/defenseCamera'

const 공 = (x: number, z: number, height: number, extra: object = {}) => ({ x, z, height, isFlying: true, ...extra })
const 오프셋 = { x: -100, y: -200 }

describe('공 그리기 0x36dfc 파티클', () => {
  it('큰 타구(+0x199a · 종류 1)면 공 자리 (x, y − h) 에 id 4 · img 10 을 그림마다 쏜다', () => {
    const ball = 공(20000, 20000, 3000)
    const shots = ballParticleShotsOf({ ball, ballParticles: { bigHit: true, bounceNextHeight: null } }, 오프셋)
    expect(shots).toEqual([
      {
        ...BIG_HIT_BALL_PARTICLE,
        x: -100 + toScreenX(20000),
        y: -200 + toScreenY(20000) - toScreenY(3000),
        bounce: false,
      },
    ])
  })

  it('높이 투영이 0 이고 다음 점 높이 투영이 0 이 아니면 바닥점에 id 0 · img 8 (튐)', () => {
    const ball = 공(20000, 20000, 50)
    expect(toScreenY(50)).toBe(0)
    const shots = ballParticleShotsOf({ ball, ballParticles: { bigHit: false, bounceNextHeight: 400 } }, 오프셋)
    expect(shots).toEqual([
      { ...BOUNCE_BALL_PARTICLE, x: -100 + toScreenX(20000), y: -200 + toScreenY(20000), bounce: true },
    ])
  })

  it('다음 점 높이 투영도 0 이거나 화면 밖 조건이 안 맞으면(null) 튐이 없다', () => {
    const ball = 공(20000, 20000, 0)
    expect(ballParticleShotsOf({ ball, ballParticles: { bigHit: false, bounceNextHeight: 60 } }, 오프셋)).toEqual([])
    expect(ballParticleShotsOf({ ball, ballParticles: { bigHit: false, bounceNextHeight: null } }, 오프셋)).toEqual([])
  })

  it('높이 투영이 0 이 아니면 튐 갈래가 아니다(레이저 잔상 갈래)', () => {
    const ball = 공(20000, 20000, 1000)
    expect(ballParticleShotsOf({ ball, ballParticles: { bigHit: false, bounceNextHeight: 2000 } }, 오프셋)).toEqual([])
  })

  it('땅점 화면 y 가 1 보다 작으면 튐을 안 쏜다 — 큰 타구는 그 문 앞이라 쏜다', () => {
    const ball = 공(20000, 1000, 0)
    const shots = ballParticleShotsOf(
      { ball, ballParticles: { bigHit: true, bounceNextHeight: 2000 } },
      { x: 0, y: -toScreenY(1000) },
    )
    expect(shots.map((shot) => shot.id)).toEqual([BIG_HIT_BALL_PARTICLE.id])
  })

  it('쥔 공 · 담장 뒤 공은 그리지 않아 아무것도 안 쏜다', () => {
    const facts = { bigHit: true, bounceNextHeight: 2000 }
    expect(ballParticleShotsOf({ ball: 공(1, 1, 0, { isHeld: true }), ballParticles: facts }, 오프셋)).toEqual([])
    expect(ballParticleShotsOf({ ball: 공(1, 1, 0, { isBeyondFence: true }), ballParticles: facts }, 오프셋)).toEqual([])
  })

  it('진행기 조건이 없으면(재생 · 주자 판) 안 쏜다', () => {
    expect(ballParticleShotsOf({ ball: 공(1, 20000, 0) }, 오프셋)).toEqual([])
  })
})
