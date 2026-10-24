import { describe, expect, it } from 'vitest'
import { launchTrajectory } from '@/entities/batting/model/battedBallFlight'
import { actionStartTickOf } from '@/entities/fielding/model/catchPrediction'
import { createFielders } from '@/entities/fielding/model/fieldingState'
import { chaseLooseBall } from '@/features/defense-play/model/looseBallChase'

describe('판 도중 깐 공의 포구 종류 · 동작 시작 틱 — 고르기 0xb3b38 의 +0x16c · +0x176 (r176)', () => {
  it('받는(줍는) 포구도 타구처럼 종류와 판 틱 동작 시작 틱을 든다 — 판 틱 b4134 가 그 틱에 포구 동작을 건다', () => {
    const ball = launchTrajectory({ from: { x: 20000, y: 1000, z: 21000 }, speed: 600, verticalSpeed: 20, angle: -90 })
    const chase = chaseLooseBall(ball, 7, createFielders(Array(9).fill(500)), {}, 240)
    expect(chase.kind).toBeDefined()
    expect(chase.actionStartTick).toBe(actionStartTickOf(chase.kind!, chase.catchTick))
  })
})
