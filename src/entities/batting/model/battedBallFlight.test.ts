import { describe, expect, it } from 'vitest'
import {
  BATTING_POINT,
  battedBallTrajectory,
  carryDistanceOf,
  clearedFence,
  landingPointOf,
  launchTrajectory,
  MAXIMUM_TRAJECTORY_POINTS,
  spliceTrajectory,
  trajectoryWithRandom,
} from '@/entities/batting/model/battedBallFlight'
import { BATTED_BALL_PATTERNS } from '@/shared/config/original/battedBallPatterns'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 원본 패턴 표에서 그대로 꺼낸 항목들 — 값을 지어내지 않는다 */
const 가운데담장면 = BATTED_BALL_PATTERNS[0][0] // [90, 810, 1592, 0] 결과 코드 0
const 가운데홈런 = BATTED_BALL_PATTERNS[24][0] // [90, 815, 1592, 0] 결과 코드 24
const 폴홈런 = BATTED_BALL_PATTERNS[24][18] // [45, 1402, 991, 0]

/** rand 굴림을 정해 두는 난수 — randomIntegerBelow(r, −25, 25) 가 `값` 이 되게 */
const 굴림 = (값: number): RandomPort => ({
  next: () => (값 + 25) / 50,
  nextInRange: (minimum) => minimum,
  pick: (candidates) => candidates[0],
})

describe('타구 궤적 — 원본 세계 0xbfed0 (공 vtable 0xd7afc)', () => {
  it('시작점은 원본 배팅 지점 (20000, 1000, 30000) 이고 각은 패턴 각의 부호를 뒤집는다 (0xb0b01)', () => {
    const 궤적 = battedBallTrajectory(가운데담장면)

    expect(궤적.pointAt(0)).toEqual(BATTING_POINT)
    expect(궤적.startedAtPlate).toBe(true)
    expect(궤적.pointDetailAt(0)).toMatchObject({ speed: 810, verticalSpeed: 1592, angle: -90, bounceMark: 0 })
  })

  it('한 틱 0xa28c0 — x += cos16(각)·속도 >> 16 · z += sin16·속도 >> 16 · y = y0 + v0·t − (90·t·t >> 1)', () => {
    const 궤적 = battedBallTrajectory(가운데담장면)

    // sin16(−90) = −65535 → (−65535·810) >> 16 = −810 (산술 밀기는 내림)
    expect(궤적.pointAt(1)).toEqual({ x: 20_000, y: 1_000 + 1_592 - 45, z: 29_190 })
    expect(궤적.pointAt(2)).toEqual({ x: 20_000, y: 1_000 + 1_592 * 2 - 180, z: 28_380 })
    expect(궤적.pointAt(18).y).toBe(1_000 + 1_592 * 18 - ((90 * 18 * 18) >> 1))
  })

  it('높이 ≤ 1999 에서 가운데 담장 면(z = 1820)에 맞으면 aa8 · 각 2φ − a · v0 ×1.7 · 속도 ½ 뒤 바운드 (0xa2cae)', () => {
    const 궤적 = battedBallTrajectory(가운데담장면)

    expect(궤적.wallTick).toBe(35)
    expect(궤적.fenceTick).toBe(-1)
    // 교차점 높이 = 3108 + (1820 − 2460)·(1595 − 3108)/(1650 − 2460) = 1913 ≤ 1999 → 담장 면
    // 위치는 x·z 만 교차점으로, 높이는 그대로 · 각 = 2·0 − (−90) = 90
    // v0 = 1592·170/100 = 2706 → 바운드 0xbf348: +0x48 = v0 = 2706·50/100 = 1353 · 속도 = (810 >> 1)·75/100 = 303
    expect(궤적.pointDetailAt(35)).toEqual({
      x: 20_000,
      y: 1_595,
      z: 1_820,
      speed: 303,
      verticalSpeed: 1_353,
      angle: 90,
      bounceMark: 1,
    })
  })

  it('담장 면 충돌은 비행 틱 t 를 안 되돌린다 — 다음 틱 높이가 새 v0 로 다시 계산돼 곧바로 땅에 닿는다 (원본 그대로)', () => {
    const 궤적 = battedBallTrajectory(가운데담장면)

    // y = 1000 + 1353·36 − 45·36² < 0 → 0 · 낙구 aa0 = 36
    expect(궤적.landingTick).toBe(36)
    expect(궤적.pointAt(36).y).toBe(0)
    // 되튄 공은 홈 쪽(z 가 커지는 쪽)으로 굴러 온다
    expect(궤적.pointAt(40).z).toBeGreaterThan(궤적.pointAt(36).z)
  })

  it('담장 위로 넘으면 aa4 가 남고 궤적은 담장 밖으로 계속 간다 (0xa2c28) · ac0 = 낙구 거리 ÷ 265 (0xa2a88)', () => {
    const 궤적 = battedBallTrajectory(BATTED_BALL_PATTERNS[24][2]) // [126, 1337, 1006, 0]
    const 낙구 = landingPointOf(궤적)
    const 거리 = Math.floor(Math.sqrt((낙구.x - 20_000) ** 2 + (낙구.z - 30_000) ** 2))

    expect(clearedFence(궤적)).toBe(true)
    expect(궤적.fenceTick).toBe(21)
    expect(궤적.landingTick).toBe(24)
    expect(궤적.carryScale).toBe(Math.min(160, Math.trunc(거리 / 265)))
    expect(궤적.carryScale).toBe(121)
    expect(궤적.length).toBeGreaterThan(궤적.landingTick + 1)
  })

  it('끝 마디 0 · 6 은 x 범위를 안 거르는 무한 직선이다 — 가운데 홈런이 담장 밖 멀리 굴러 그 연장선에 맞고 꺾이면 ac0 은 0 (원본 그대로)', () => {
    const 궤적 = battedBallTrajectory(가운데홈런)

    expect(궤적.fenceTick).toBe(35)
    expect(궤적.landingTick).toBe(36)
    // 마디 6 의 연장선은 x = 20000 에서 z ≈ −14566 — 담장 밖으로 굴러간 공이 거기서 꺾인다
    expect(궤적.wallTick).toBe(63)
    expect(궤적.pointAt(63).z).toBeLessThan(-14_000)
    // 마무리 0xa2a88 은 **마지막 각**이 페어(−135 ~ −45)일 때만 눈금을 적는다
    expect(궤적.carryScale).toBe(0)
  })

  it('폴(각이 꼭 −45 이고 1999 < 높이 ≤ 7000) — ab0 · 각 = 2φ − a + rand(−25, 25) · 위치 = 교차점 · 속도 ½ (0xa2c48)', () => {
    const 궤적 = battedBallTrajectory(폴홈런)

    expect(궤적.poleTick).toBe(20)
    expect(궤적.fenceTick).toBe(-1)
    expect(궤적.flight.randomRolls).toBe(1)
    // 마디 6 (38055, 8905)→(40000, 11440) 기울기 130 → atan 52° · 2·52 − (−45) = 149 (난수 없으면 굴림 0)
    expect(궤적.pointDetailAt(20)).toMatchObject({ speed: 701, angle: 149, bounceMark: 1 })
  })

  it('폴 굴림은 난수를 받은 쪽이 다시 깐다 — 굴림이 없던 궤적은 그대로다', () => {
    const 궤적 = battedBallTrajectory(폴홈런)
    const 다시 = trajectoryWithRandom(궤적, 굴림(-25))

    expect(다시.poleTick).toBe(20)
    expect(다시.pointDetailAt?.(20).angle).toBe(124)
    expect(trajectoryWithRandom(battedBallTrajectory(가운데홈런), 굴림(7))).not.toBe(궤적)
    const 굴림없음 = battedBallTrajectory(가운데홈런)
    expect(trajectoryWithRandom(굴림없음, createSeededRandom(1))).toBe(굴림없음)
  })

  it('꺾인 바로 다음 틱은 충돌을 안 본다 — 앞 점의 바운드 표시 (0x9f820)', () => {
    const 궤적 = battedBallTrajectory(가운데담장면)

    expect(궤적.pointDetailAt(36).bounceMark).toBe(0)
  })

  it('플래그 비트0 은 높이 부호를 뒤집는다 (0xb07b4) — 내리꽂는 타구가 된다', () => {
    const 보통 = battedBallTrajectory(BATTED_BALL_PATTERNS[3][14])
    const 반전 = battedBallTrajectory(BATTED_BALL_PATTERNS[3][15]) // [81, 897, 290, 1]

    expect(반전.pointDetailAt(0).verticalSpeed).toBe(-290)
    // y = 1000 − 290·t − 45·t² → 665 · 240 · 땅
    expect(반전.pointAt(1).y).toBe(665)
    expect(반전.landingTick).toBe(3)
    expect(보통.landingTick).toBeGreaterThan(1)
  })

  it('땅에 닿으면 수직 ½ · 수평 ¾ 로 튀고, 뜨지 못하면 0.95 씩 굴러 멈춘다 (0xbf240 · 0xa292c · 0xbf348)', () => {
    const 땅볼 = battedBallTrajectory(BATTED_BALL_PATTERNS[4][0]) // [133, 500, 300, 1]
    const 끝 = 땅볼.length - 1

    expect(땅볼.length).toBeLessThan(MAXIMUM_TRAJECTORY_POINTS)
    expect(땅볼.isStoppedAt(끝)).toBe(true)
    expect(땅볼.isStoppedAt(끝 - 1)).toBe(false)
    expect(땅볼.pointDetailAt(끝)).toMatchObject({ y: 0, speed: 0, verticalSpeed: 0 })
    // 구르는 동안 속도는 앞 점의 95%(버림)
    const 구르기 = 땅볼.pointDetailAt(끝 - 5)
    expect(땅볼.pointDetailAt(끝 - 4).speed).toBe(Math.trunc((구르기.speed * 95) / 100))
  })

  it('점 목록은 130 개를 넘지 않고, 밖의 틱은 양끝으로 자른다 (0xa2b78)', () => {
    const 궤적 = battedBallTrajectory(가운데담장면)

    expect(궤적.length).toBeLessThanOrEqual(MAXIMUM_TRAJECTORY_POINTS)
    expect(궤적.pointAt(-5)).toEqual(궤적.pointAt(0))
    expect(궤적.pointAt(9999)).toEqual(궤적.pointAt(궤적.length - 1))
  })

  it('원본 패턴 표 전체가 멈추거나 130 점에서 끝난다 — 홈런 묶음(24~26)은 거의 다 담장을 넘는다', () => {
    let 홈런묶음 = 0
    let 넘김 = 0
    for (const [code, patterns] of Object.entries(BATTED_BALL_PATTERNS)) {
      for (const pattern of patterns) {
        const 궤적 = battedBallTrajectory(pattern)
        expect(궤적.length).toBeGreaterThan(1)
        expect(궤적.length).toBeLessThanOrEqual(MAXIMUM_TRAJECTORY_POINTS)
        expect(궤적.isStoppedAt(궤적.length - 1)).toBe(true)
        if (Number(code) >= 24) {
          홈런묶음 += 1
          if (clearedFence(궤적)) 넘김 += 1
        }
      }
    }
    expect(넘김).toBe(97)
    expect(홈런묶음).toBe(99)
  })

  it('놓을 곳·속도·각을 바로 주고 쏠 수도 있다 — 펌블 0xb32e8 · 튕김 0xb3148 의 다시 쏘기', () => {
    const 궤적 = launchTrajectory({ from: { x: 20_000, y: 0, z: 20_000 }, speed: 300, verticalSpeed: -60, angle: 0 })

    expect(궤적.startedAtPlate).toBe(false)
    // 높이 0 에서 아래로 쏘면 첫 틱에 땅 — +0x48 = isqrt(60²) − (−60) + |−60| = 180
    expect(궤적.landingTick).toBe(1)
    // cos16(0) = 65535 → (65535·300) >> 16 = 299 · 바운드 0xa292c(+0x39): +0x48 = 180·50/100 = 90 · 속도 300·75/100 = 225
    expect(궤적.pointDetailAt(1)).toMatchObject({ x: 20_299, y: 0, verticalSpeed: 90, speed: 225 })
  })

  it('다시 쏜 공은 그 틱부터 새 궤적의 0 번 점이다 — 사건 틱은 새 것, 이미 떨어진 공의 낙구는 그대로 (0xb3148 · b12da)', () => {
    const 앞 = battedBallTrajectory(BATTED_BALL_PATTERNS[4][0]) // 낙구 4
    const 새 = launchTrajectory({ from: 앞.pointAt(12), speed: 300, verticalSpeed: 87, angle: -92, body: 앞.flight.body })
    const 이음 = spliceTrajectory(앞, 12, 새)

    expect(이음.pointAt(11)).toEqual(앞.pointAt(11))
    expect(이음.pointAt(12)).toEqual(새.pointAt(0))
    expect(이음.pointAt(13)).toEqual(새.pointAt(1))
    expect(이음.landingTick).toBe(앞.landingTick)
    expect(이음.fenceTick).toBe(-1)
    expect(이음.length).toBe(12 + 새.length)
    expect(이음.isStoppedAt(12 + 새.length - 1)).toBe(true)
  })

  it('세기가 크면 더 멀리 간다', () => {
    expect(carryDistanceOf(battedBallTrajectory(BATTED_BALL_PATTERNS[24][0]))).toBeGreaterThan(
      carryDistanceOf(battedBallTrajectory(BATTED_BALL_PATTERNS[6][0])),
    )
  })
})

describe('플레이 +0x127 — 패턴 플래그 비트 1 (0x514e6 · 0xb07c8)', () => {
  it('비트 1 이 선 패턴만 landingChase 를 싣고, 다시 쏘거나(splice) 난수로 다시 깔아도 남는다', () => {
    const 선 = battedBallTrajectory([67, 1350, 650, 2]) // 원본 2루타 묶음의 비트 1 패턴
    expect(선.landingChase).toBe(true)
    expect(battedBallTrajectory([67, 1350, 650, 0]).landingChase).toBeUndefined()
    // 비트 0(높이 부호)만 선 패턴은 아니다
    expect(battedBallTrajectory([112, 898, 898, 8]).landingChase).toBeUndefined()
    const 다시 = launchTrajectory({ from: 선.pointAt(20), speed: 300, verticalSpeed: 50, angle: -90 })
    expect(spliceTrajectory(선, 20, 다시).landingChase).toBe(true)
  })
})
