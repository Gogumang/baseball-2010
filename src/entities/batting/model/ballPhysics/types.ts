import type { WorldPoint } from '@/entities/batting/model/ballPhysics/otherSlices'

/** 점 하나 (0xa29bc 가 적는 20바이트) */
export interface BallPoint extends WorldPoint {
  /** +0xc 수평 속도 (s16) */
  readonly speed: number
  /** +0xe 수직 속도 v0 (s16) */
  readonly verticalSpeed: number
  /** +0x10 각 (s16, 도). 원본 각은 패턴 각의 부호를 뒤집은 것이다 — −90 이 가운데, −45 가 1루 쪽 파울선 */
  readonly angle: number
  /** +0x12 바운드 표시 a9c — 이 점에서 담장·폴에 맞고 꺾였다 */
  readonly bounceMark: number
}

/** 미리 계산이 끝난 공의 사건 틱 (모두 −1 로 시작) */
export interface BallEvents {
  /** +0xaa0 — 처음으로 높이 ≤ 0 이 된 점 */
  readonly landingTick: number
  /** +0xaa4 — 담장(또는 파울 쪽 관중석) **위로** 넘는 충돌 */
  readonly fenceTick: number
  /** +0xaa8 — 높이 ≤ 1999 에서 담장 면에 맞고 꺾인 충돌 */
  readonly wallTick: number
  /** +0xab0 — 파울 폴(각이 꼭 −45 · −135 일 때 1999 < 높이 ≤ 7000)에 맞은 충돌 */
  readonly poleTick: number
  /** +0xac0 — 담장을 넘은 페어 타구의 낙구 거리 눈금 0~160 (그 밖 0) */
  readonly carryScale: number
  /** +0xac4 — 낙구점이 홈에서 10274 넘게 떨어진 페어 타구 */
  readonly deepHit: boolean
}

/** 공 객체의 물리 칸 — 미리 계산이 끝난 뒤의 값을 다음 발사(펌블 · 튕김 0xb3148 — vt78 0xb32e8 은 부르는 곳이 없다, U-101)가 이어 받는다 */
export interface BallBody {
  /** +0x20 위치 */
  x: number
  y: number
  z: number
  /** +0x14 기준점 — +0x18 이 y0 */
  originX: number
  originY: number
  originZ: number
  /** +0x2c 목표 (위치를 놓을 때 0xbf2cc 가 바꾼다) */
  targetX: number
  targetY: number
  targetZ: number
  /** +0x3c 수평 속도 */
  speed: number
  /** +0x40 수직 속도 v0 */
  verticalSpeed: number
  /** +0x44 중력 */
  gravity: number
  /** +0x48 다음 바운드 속도 */
  bounceSpeed: number
  /** +0x4c 비행 틱 */
  flightTick: number
  /** +0x70 각 */
  angle: number
  /** +4 · +8 · +0xc · +0x10 — 바운드 수평 · 바운드 수직 · 구르기 · 멈춘 공 수직 (%) */
  bounceHorizontalPercent: number
  bounceVerticalPercent: number
  rollPercent: number
  restVerticalPercent: number
  /** +0x38 땅 위 · +0x39 이번 틱 착지 · +0x3a 멈춤 · +0x3b 이번 틱 멈춤 */
  onGround: boolean
  landedThisTick: boolean
  stopped: boolean
  stoppedThisTick: boolean
  /** +0x50 얼림 · +0x51 · +0x52 · +0x53 바운드 켬 · +0x54 다시 쏨 */
  frozen: boolean
  flag51: boolean
  flag52: boolean
  bounces: boolean
  relaunched: boolean
  /** +0xa9c 바운드 표시 */
  bounceMark: number
}

/** 미리 계산 결과 */
export interface BallFlight {
  readonly points: readonly BallPoint[]
  readonly events: BallEvents
  /** 이 계산에서 돈 rand 굴림 수 (폴 충돌 0xa2c64 의 rand(−25, 25)) */
  readonly randomRolls: number
  /** 계산이 끝난 공 — 다음 발사가 이 칸들을 이어 받는다 */
  readonly body: BallBody
}

/** 미리 계산 도중의 사건 틱 — 다 돌면 `BallEvents` 로 내보낸다 */
export interface MutableEvents {
  landingTick: number
  fenceTick: number
  wallTick: number
  poleTick: number
  carryScale: number
  deepHit: boolean
}

/** 이 계산에서 돈 rand 굴림 수 칸 (`BallFlight.randomRolls`) */
export interface RollCount {
  count: number
}
