import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'
import {
  FASTBALL_FLAME_ANIMATION,
  animationLengthOf,
  fastballFlameBallTickOf,
  fastballFlameFrameAt,
  hasFastballFlame,
} from '@/widgets/batting-stage/lib/fastballFlame'

const animations = JSON.parse(readFileSync('public/sprites/game_effect/frames/animations.json', 'utf8')) as {
  frame: number
  delay: number
}[][]
const 불꽃 = animations[FASTBALL_FLAME_ANIMATION]

const 공 = (displaySpeedKmh: number, x: number): Pitch => ({
  type: 'FASTBALL',
  plate: { x: 0, y: 0 },
  breakOffset: { x: 0, y: 0 },
  flightDurationMilliseconds: 0,
  frameCount: 2,
  controlTier: 3,
  stageSide: 1,
  displaySpeedKmh,
  worldPath: [
    { x: 0, y: 0, z: 0 },
    { x, y: ZONE_CENTERS[1].y, z: ZONE_CENTERS[1].z },
  ],
})

describe('강속구 불꽃 — 0x3b2f4 꼬리 0x3b6e4~0x3b7d8 (game_effect 애니 1)', () => {
  it('애니 1 = 12(2틱) 13~17(1틱) 21(지연 0 → 1틱), 전체 길이 0x94071 = 8', () => {
    expect(불꽃.map((entry) => entry.frame)).toEqual([12, 13, 14, 15, 16, 17, 21])
    expect(animationLengthOf(불꽃)).toBe(8)
  })

  it('공 틱 N 부터 N + 8 까지만 — 그린 틱마다 한 칸 (3b6fc · 3b794)', () => {
    const N = 20
    expect(fastballFlameFrameAt(불꽃, N - 1, N)).toBeNull()
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => fastballFlameFrameAt(불꽃, N + k, N))).toEqual([
      12, 12, 13, 14, 15, 16, 17, 21, 21,
    ])
    expect(fastballFlameFrameAt(불꽃, N + 9, N)).toBeNull()
  })

  it('표시 구속이 151 을 넘고(3b7a4 cmp #0x97 / ble) 도착점이 존 상자 0xcfb7c 안이어야 한다', () => {
    const 한가운데 = ZONE_CENTERS[1].x
    expect(hasFastballFlame(공(152, 한가운데))).toBe(true)
    expect(hasFastballFlame(공(151, 한가운데))).toBe(false)
    expect(hasFastballFlame(공(170, 한가운데 + 3000))).toBe(false)
  })

  // 0x12 틱 0 은 공 틱 N + 1 이 예약한 다음 틀(0xbc9c8)이라 공 틱 N + 2 다 — 0x3f378 은 0x12 에서도 +1
  it('상태 0x11 · 0x12 만 — 웹 투구중은 공 프레임, 안 친 공 결과는 N + 2 + 단계 틱, 타격 · 인플레이 · 대기는 없다', () => {
    expect(fastballFlameBallTickOf({ kind: '투구중', tick: 30, isPaused: false }, 21, 20)).toBe(21)
    expect(fastballFlameBallTickOf({ kind: '결과', tick: 3, isPaused: false }, -1, 20)).toBe(25)
    expect(fastballFlameBallTickOf({ kind: '결과', tick: 3, isPaused: false, isInPlay: true }, -1, 20)).toBeNull()
    expect(fastballFlameBallTickOf({ kind: '타격', tick: 0, isPaused: false }, -1, 20)).toBeNull()
    expect(fastballFlameBallTickOf({ kind: '대기', tick: 0, isPaused: false }, -1, 20)).toBeNull()
    expect(fastballFlameBallTickOf(undefined, 21, 20)).toBeNull()
  })
})
