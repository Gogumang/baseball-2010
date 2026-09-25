import { describe, expect, it } from 'vitest'
import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import {
  hitParticleIdOf,
  hitParticleInputOf,
  isStrongHit,
  isWeakHit,
  NORMAL_HIT_PARTICLE_ID,
  specialSwingParticlesOf,
  STRONG_HIT_PARTICLE_ID,
} from '@/widgets/batting-stage/lib/hitParticles'

/** 가운데(90°)로 간 보통 세기의 타구 */
const 보통 = { resultCode: 0, angle: 90, speed: 700, height: 700, isBigHit: false }

describe('강한 타구 0x35988', () => {
  it('속도가 1200 을 넘으면 강하다', () => {
    expect(isStrongHit({ angle: 90, speed: 1201, height: 0 })).toBe(true)
    expect(isStrongHit({ angle: 90, speed: 1200, height: 0 })).toBe(false)
  })

  it('1000 < b ≤ 1200 이면 높이가 600 을 넘을 때 강하다', () => {
    expect(isStrongHit({ angle: 90, speed: 1100, height: 601 })).toBe(true)
    // 높이가 문턱에 못 미치면 다음 가지(b + |c| > 1599)로 떨어진다 — 1100 + 400 = 1500 이라 약하다
    expect(isStrongHit({ angle: 90, speed: 1100, height: 400 })).toBe(false)
  })

  it('b > 800 이고 b + |c| > 1599 면 강하다 (높이는 절댓값)', () => {
    expect(isStrongHit({ angle: 90, speed: 900, height: -700 })).toBe(true)
    expect(isStrongHit({ angle: 90, speed: 800, height: -900 })).toBe(false)
  })

  it('각이 −145 < a < −35 (웹 35~145) 밖이면 강하지 않다', () => {
    expect(isStrongHit({ angle: 35, speed: 1500, height: 0 })).toBe(false)
    expect(isStrongHit({ angle: 145, speed: 1500, height: 0 })).toBe(false)
    expect(isStrongHit({ angle: 36, speed: 1500, height: 0 })).toBe(true)
  })
})

describe('약한 타구 0x39304', () => {
  it('원본 −165 < a < −75 (웹 75~165) 면 b·|c| 가 둘 다 449 이하여야 한다', () => {
    expect(isWeakHit({ angle: 90, speed: 449, height: 449 })).toBe(true)
    expect(isWeakHit({ angle: 90, speed: 450, height: 100 })).toBe(false)
    expect(isWeakHit({ angle: 90, speed: 100, height: 450 })).toBe(false)
  })

  it('그 밖의 각이면 b ≤ 349·|c| ≤ 899 거나 b ≤ 549·|c| ≤ 549 다', () => {
    expect(isWeakHit({ angle: 50, speed: 349, height: 899 })).toBe(true)
    expect(isWeakHit({ angle: 50, speed: 549, height: 549 })).toBe(true)
    expect(isWeakHit({ angle: 50, speed: 400, height: 700 })).toBe(false)
  })
})

describe('타격 불꽃 고르기 (0x49e64)', () => {
  it('감상 플래그가 켜졌으면 타격 순간엔 안 쏜다', () => {
    expect(hitParticleIdOf({ ...보통, isBigHit: true })).toBeNull()
  })

  it('결과 코드 24~26 은 006 (id 5) 이다', () => {
    expect([24, 25, 26].map((resultCode) => hitParticleIdOf({ ...보통, resultCode }))).toEqual([
      STRONG_HIT_PARTICLE_ID,
      STRONG_HIT_PARTICLE_ID,
      STRONG_HIT_PARTICLE_ID,
    ])
  })

  it('강한 타구도 006 (id 5) 이다', () => {
    expect(hitParticleIdOf({ ...보통, speed: 1400 })).toBe(STRONG_HIT_PARTICLE_ID)
  })

  it('약한 타구는 아무것도 안 쏜다', () => {
    expect(hitParticleIdOf({ ...보통, speed: 300, height: 300 })).toBeNull()
  })

  it('그 밖은 007 (id 6) 이다', () => {
    expect(hitParticleIdOf(보통)).toBe(NORMAL_HIT_PARTICLE_ID)
  })

  it('패턴 플래그 비트0 은 높이 부호를 뒤집는다', () => {
    expect(hitParticleInputOf([90, 900, 700, 1], 0, false).height).toBe(-700)
    expect(hitParticleInputOf([90, 900, 700, 0], 0, false).height).toBe(700)
  })
})

describe('필살타법 파티클 (0x49aec)', () => {
  it('번호 1·2·3 은 각각 002·012·010 을 하나씩 쓴다', () => {
    expect([1, 2, 3].map((number) => specialSwingParticlesOf(number, 0).map((one) => one.id))).toEqual([[1], [11], [9]])
  })

  it('토네이도(3)는 25px 아래에서 터진다', () => {
    expect(specialSwingParticlesOf(3, 0)[0]?.offsetY).toBe(25)
  })

  it('번호 4 는 폼 니블 2·3(장타형)이면 013, 아니면 021 이다 (0xb8e6c)', () => {
    // 폼 = 2 × 타입 + 손. 타입 0(타격형) 은 0·1, 타입 1(장타형) 은 2·3
    expect([0, 1].map((form) => specialSwingParticlesOf(4, form)[0]?.id)).toEqual([20, 20])
    expect([2, 3].map((form) => specialSwingParticlesOf(4, form)[0]?.id)).toEqual([12, 12])
    expect(specialSwingParticlesOf(4, 2)[0]?.img).toBe(1)
    expect(specialSwingParticlesOf(4, 0)[0]?.img).toBe(1)
  })

  it('안 배운 타자(0)는 안 쏜다', () => {
    expect(specialSwingParticlesOf(0, 0)).toEqual([])
  })

  it('마타자 순번은 점프표 0xd01e4 그대로다', () => {
    const 쏘는것 = [0, 1, 2, 3, 4].map((index) =>
      specialSwingParticlesOf(0, 0, index).map((one) => [one.id, one.img]))
    expect(쏘는것).toEqual([
      [[9, 2]],
      [[18, 1], [19, 1]],
      [[13, 1], [1, 6]],
      [[20, 5]],
      [[17, 13]],
    ])
  })

  it('크라이져(3)만 25px 아래에서 터진다', () => {
    expect([0, 1, 2, 3, 4].map((index) => specialSwingParticlesOf(0, 0, index)[0]?.offsetY))
      .toEqual([0, 0, 0, 25, 0])
  })

  it('마타자면 필살 번호는 안 본다 (0x49b4e 가 먼저 가른다)', () => {
    expect(specialSwingParticlesOf(1, 0, 4).map((one) => one.id)).toEqual([17])
  })

  it('순번은 ACE_PLAYERS 타자 다섯의 배열 색인이다', () => {
    const 마타자 = ACE_PLAYERS.filter((player) => player.role === '타자')
    expect(마타자.map((player) => player.id)).toEqual(['medica', 'kao', 'roze', 'death', 'tiger'])
    // 다섯 줄이 모두 채워져 있어야 점프표를 다 옮긴 것이다
    expect(마타자.every((_, index) => specialSwingParticlesOf(0, 0, index).length > 0)).toBe(true)
  })
})
