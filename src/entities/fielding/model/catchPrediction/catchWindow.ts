import { isOutfieldSlot, manhattanDistance, type WorldPoint } from '@/entities/fielding/model/fieldGeometry'

/** 포구 종류 (+0x16c). 고르기 우선순위와 동작 시작 틱이 여기에 달려 있다 */
export const CATCH_KIND = {
  /** 낮은 공 (h ≤ 1000) — 표 +0x60 */
  LOW: 0,
  /** 가슴 높이 (1001 ≤ h ≤ 1700) — 표 +0x84 */
  CHEST: 1,
  /** 바운드 전 낮은 공 (h ≤ 500, 반경 1000) — 표 +0xa8 */
  GROUNDER: 2,
  /** 필살 점프 캐치 (1701 ≤ h ≤ 4000) — 표 +0x3c */
  JUMP: 3,
  /** 필살 슬라이딩 캐치 (501 ≤ h ≤ 1500) — 표 +0xcc */
  SLIDE: 4,
} as const

export type CatchKind = (typeof CATCH_KIND)[keyof typeof CATCH_KIND]

/** 포구 반경 — 내야 500 · 외야 300 (0xb1644: #0xfa<<1 / #0x96<<1) */
export const CATCH_RADIUS_INFIELD = 500
export const CATCH_RADIUS_OUTFIELD = 300
/** 바운드 전 낮은 공의 넓은 반경 (0xb1584 계열) */
export const GROUNDER_RADIUS = 1000
/** 점프 캐치의 상자 반경 — x·z 각각 ±299 (0xb16ea: #0x12b) */
export const JUMP_BOX = 299
/** 슬라이딩 캐치 거리 창 — 1999 < d ≤ 3000 (0xb177e: 0x7cf · 0xbb8) */
export const SLIDE_DISTANCE = { minimum: 1999, maximum: 3000 } as const
/** 다이빙(아깝게 못 닿는 땅볼) 후보 거리 창 — 1000 < d ≤ 2000 */
export const DIVE_DISTANCE = { minimum: 1000, maximum: 2000 } as const

/** 높이 창 (0xb14e2~0xb1584) */
export const HEIGHT_WINDOW = {
  /** 낮은 공 h ≤ 1000 */
  low: 1000,
  /** 가슴 높이 1001 ≤ h ≤ 1700 */
  chest: { minimum: 1001, maximum: 1700 },
  /** 바운드 전 낮은 공 h ≤ 500 */
  grounder: 500,
  /** 필살 점프 1701 ≤ h ≤ 4000 */
  jump: { minimum: 1701, maximum: 4000 },
  /** 필살 슬라이딩 501 ≤ h ≤ 1500 (h ≤ 500 인 공은 빠진다) */
  slide: 1500,
} as const

export function catchRadiusOf(slot: number): number {
  return isOutfieldSlot(slot) ? CATCH_RADIUS_OUTFIELD : CATCH_RADIUS_INFIELD
}

export interface CatchWindowInput {
  readonly slot: number
  /** 야수(복제)의 위치 +0x20. **공 지점이 아니라 야수가 서 있는 곳**이다 */
  readonly fielder: WorldPoint
  /** 이 틱의 공 예측점. y 가 높이 h */
  readonly ball: WorldPoint
  readonly tick: number
  /** 낙구 틱 (공 +0xaa0) */
  readonly landingTick: number
  /**
   * 직선 근사로 "이미 달린 틱 수" n — 0xb12d0 의 `정지면 d −= 복제.속도(+0x3c) × n[j]` (P2 2a).
   * 원본은 복제를 실제로 움직이지 않는 틱마다 n 을 올리고, 거리에서 그만큼을 빼 "그 사이 뛰었다" 로 친다.
   * 빼기만 하고 0 으로 자르지 않아 **거리가 음수가 될 수 있는 것도 원본 그대로**다
   * (음수면 포구 반경은 통과하고 슬라이딩 창 `1999 < d` 는 닫힌다).
   */
  readonly runTicks?: number
  /** 복제의 달리기 속도 +0x3c (원본은 9명 모두 220). `runTicks` 와 함께 쓴다 */
  readonly speed?: number
  /** 필살 점프 창이 열렸는가 (플레이 +0x1f5) */
  readonly jumpUnlocked?: boolean
  /** 필살 슬라이딩 창이 열렸는가 (플레이 +0x1f6) */
  readonly slideUnlocked?: boolean
  /**
   * 지정 야수만 잡게 하는 모드 (플레이 +0x1e8 · +0x154).
   * 값이 있고 내 칸이 아니면 낮은 공·가슴 높이 창이 닫힌다 (유력: 사람이 조작하는 야수).
   */
  readonly onlySlot?: number
}

/**
 * 판정에 쓰는 거리 d — 0xb12d0 의 `d = |dx| + |dz|`(복제 위치, P(t)) — **맨해튼 0xbfa2c**(b15b4, 이 함수의 거리 호출은 이것 하나다),
 * 정지 근사면 `d −= 속도 × n`.
 * 자르지 않는다(원본 그대로).
 */
export function approachedDistanceOf(input: CatchWindowInput): number {
  const distance = manhattanDistance(input.fielder, input.ball)
  const ran = (input.runTicks ?? 0) * (input.speed ?? 0)
  return distance - ran
}

/** 점프 캐치는 이 틱을 넘어야 (0xb16ea~) · 슬라이딩 캐치는 이 틱을 넘어야 · 낙구까지 남은 틱이 이 값 이하 (0xb177e~) */
const JUMP_AFTER_TICK = 7
const SLIDE_AFTER_TICK = 5
const SLIDE_BEFORE_LANDING_TICKS = 2

/** 높이 창 — 지정 야수 모드(onlySlot)면 내 칸이 아닐 때 낮은 공 · 가슴 높이가 닫힌다 */
function heightWindowsOf(input: CatchWindowInput): { readonly chest: boolean; readonly low: boolean; readonly grounder: boolean } {
  const height = input.ball.y
  const restricted = input.onlySlot !== undefined && input.onlySlot !== input.slot
  return {
    chest: !restricted && height >= HEIGHT_WINDOW.chest.minimum && height <= HEIGHT_WINDOW.chest.maximum,
    low: !restricted && height <= HEIGHT_WINDOW.low,
    grounder: height <= HEIGHT_WINDOW.grounder,
  }
}

/** 필살 점프 — 창이 열렸고 가슴 높이가 아니며 1701 ≤ h ≤ 4000, x·z 상자 ±299, 낙구 전, 틱 > 7 */
function isJumpCatch(input: CatchWindowInput, chest: boolean, beforeLanding: boolean): boolean {
  const height = input.ball.y
  const isJumpHeight = input.jumpUnlocked === true && !chest && height >= HEIGHT_WINDOW.jump.minimum && height <= HEIGHT_WINDOW.jump.maximum
  const isInBox = Math.abs(input.ball.x - input.fielder.x) <= JUMP_BOX && Math.abs(input.ball.z - input.fielder.z) <= JUMP_BOX
  return isJumpHeight && isInBox && beforeLanding && input.tick > JUMP_AFTER_TICK
}

/** 필살 슬라이딩의 높이 · 거리 창 — 창이 열렸고 501 ≤ h ≤ 1500, 1999 < d ≤ 3000 */
function isSlideWindow(input: CatchWindowInput, grounder: boolean, distance: number): boolean {
  const isSlideHeight = input.slideUnlocked === true && !grounder && input.ball.y <= HEIGHT_WINDOW.slide
  return isSlideHeight && distance > SLIDE_DISTANCE.minimum && distance <= SLIDE_DISTANCE.maximum
}

/** 필살 슬라이딩 — 높이 · 거리 창, 공이 야수보다 홈 쪽, 낙구 1~2 틱 전, 틱 > 5 */
function isSlideCatch(input: CatchWindowInput, grounder: boolean, distance: number): boolean {
  const ticksToLanding = input.landingTick - input.tick
  // 공이 야수보다 홈 쪽(z 가 큼)에 있을 때만 날아서 잡는다
  const isAhead = input.fielder.z < input.ball.z
  const isJustBeforeLanding = ticksToLanding > 0 && ticksToLanding <= SLIDE_BEFORE_LANDING_TICKS
  return isSlideWindow(input, grounder, distance) && isAhead && isJustBeforeLanding && input.tick > SLIDE_AFTER_TICK
}

/**
 * 이 틱에 이 야수가 쓸 수 있는 포구 종류들 (0xb12d0 의 판정부).
 * 원본은 종류마다 "가장 이른 틱"만 표에 적으므로, 여기서는 한 틱 분량만 돌려준다.
 */
export function catchKindsAt(input: CatchWindowInput): readonly CatchKind[] {
  const windows = heightWindowsOf(input)
  const distance = approachedDistanceOf(input)
  const radius = catchRadiusOf(input.slot)
  const beforeLanding = input.landingTick > input.tick
  const candidates: readonly (readonly [CatchKind, boolean])[] = [
    [CATCH_KIND.CHEST, windows.chest && distance <= radius],
    [CATCH_KIND.LOW, windows.low && distance <= radius],
    [CATCH_KIND.GROUNDER, windows.grounder && distance <= GROUNDER_RADIUS && beforeLanding],
    [CATCH_KIND.JUMP, isJumpCatch(input, windows.chest, beforeLanding)],
    [CATCH_KIND.SLIDE, isSlideCatch(input, windows.grounder, distance)],
  ]
  return candidates.filter(([, isOpen]) => isOpen).map(([kind]) => kind)
}

/**
 * 다이빙(아깝게 못 닿는 땅볼) 후보인가 — 표 +0x178/+0x19c (P2 2a).
 * 잡는 판정은 없고 몸을 날리는 연출·길막기다 (유력).
 */
export function isDiveCandidate(input: CatchWindowInput & { readonly startedAtPlate: boolean }): boolean {
  const distance = approachedDistanceOf(input)
  return input.startedAtPlate && input.ball.y <= HEIGHT_WINDOW.grounder && distance > DIVE_DISTANCE.minimum && distance <= DIVE_DISTANCE.maximum
}
