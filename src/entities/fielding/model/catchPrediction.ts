import {
  horizontalDistance,
  isOutfieldSlot,
  type WorldPoint,
} from '@/entities/fielding/model/fieldGeometry'

/**
 * 포구 예측기 0xb12d0 (플레이 vt 0x24) 와 추적야수 고르기 0xb3b38 (vt 0x34).
 *
 * 원본은 타구 순간 **궤적 전체를 미리 계산해 두고**(공 +0x74 부터 최대 130 점) 야수 9명을 복제해
 * 틱마다 "종류별 가장 이른 포구 틱" 표를 만든다. 그래서 수비는 "가장 가까운 야수"가 아니라
 * **가장 먼저 잡을 수 있는 야수**를 고른다 (P2 2a·1a, 확정).
 *
 * 궤적 자체(타구 물리)는 이 저장소에서 아직 안 푼 영역이다 — `BattedBallTrajectory` 인터페이스만 두고
 * 값은 바깥에서 넣는다. **투구 궤적은 pitch.zt1 원본 데이터를 쓰기로 이미 정해져 있다**(D 결정).
 */

/** 타구 궤적. 원본 공 객체 +0x74(점 목록) · +0x6c(점 개수) · +0xaa0(낙구 틱) 에 대응한다 */
export interface BattedBallTrajectory {
  /** 미리 계산된 점 개수 (공 +0x6c, 최대 130) */
  readonly length: number
  /** t 번째 점 (0xa2b78 = 0 ~ length−1 로 자른다). y 가 높이다 */
  pointAt(tick: number): WorldPoint
  /** 낙구 틱 = 처음으로 높이 ≤ 0 이 된 점 번호 (공 +0xaa0). 없으면 −1 */
  readonly landingTick: number
  /** 담장선을 넘은 첫 틱 (공 +0xaa4). 없으면 −1 */
  readonly fenceTick: number
  /** 폴(파울 기둥) 맞은 첫 틱 (공 +0xab0). 없으면 −1 */
  readonly poleTick: number
  /** 타구 시작점이 표준 배팅 지점 (20000, 1000, 30000) 인가 — 다이빙 후보 판정의 전제 (P2 2a) */
  readonly startedAtPlate: boolean
}

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
 * 판정에 쓰는 거리 d — 0xb12d0 의 `d = isqrt(dx²+dz²)(복제 위치, P(t))`, 정지 근사면 `d −= 속도 × n`.
 * 자르지 않는다(원본 그대로).
 */
export function approachedDistanceOf(input: CatchWindowInput): number {
  const distance = horizontalDistance(input.fielder, input.ball)
  const ran = (input.runTicks ?? 0) * (input.speed ?? 0)
  return distance - ran
}

/**
 * 이 틱에 이 야수가 쓸 수 있는 포구 종류들 (0xb12d0 의 판정부).
 * 원본은 종류마다 "가장 이른 틱"만 표에 적으므로, 여기서는 한 틱 분량만 돌려준다.
 */
export function catchKindsAt(input: CatchWindowInput): readonly CatchKind[] {
  const height = input.ball.y
  const restricted = input.onlySlot !== undefined && input.onlySlot !== input.slot
  const chest = !restricted && height >= HEIGHT_WINDOW.chest.minimum && height <= HEIGHT_WINDOW.chest.maximum
  const low = !restricted && height <= HEIGHT_WINDOW.low
  const grounderHeight = height <= HEIGHT_WINDOW.grounder
  const jump =
    input.jumpUnlocked === true &&
    !chest &&
    height >= HEIGHT_WINDOW.jump.minimum &&
    height <= HEIGHT_WINDOW.jump.maximum
  const slide = input.slideUnlocked === true && !grounderHeight && height <= HEIGHT_WINDOW.slide

  const distance = approachedDistanceOf(input)
  const radius = catchRadiusOf(input.slot)
  const beforeLanding = input.landingTick > input.tick
  const kinds: CatchKind[] = []

  if (chest && distance <= radius) kinds.push(CATCH_KIND.CHEST)
  if (low && distance <= radius) kinds.push(CATCH_KIND.LOW)
  if (grounderHeight && distance <= GROUNDER_RADIUS && beforeLanding) kinds.push(CATCH_KIND.GROUNDER)
  if (
    jump &&
    Math.abs(input.ball.x - input.fielder.x) <= JUMP_BOX &&
    Math.abs(input.ball.z - input.fielder.z) <= JUMP_BOX &&
    beforeLanding &&
    input.tick > 7
  ) {
    kinds.push(CATCH_KIND.JUMP)
  }
  if (
    slide &&
    distance > SLIDE_DISTANCE.minimum &&
    distance <= SLIDE_DISTANCE.maximum &&
    // 공이 야수보다 홈 쪽(z 가 큼)에 있을 때만 날아서 잡는다
    input.fielder.z < input.ball.z &&
    input.landingTick - input.tick > 0 &&
    input.landingTick - input.tick <= 2 &&
    input.tick > 5
  ) {
    kinds.push(CATCH_KIND.SLIDE)
  }
  return kinds
}

/**
 * 다이빙(아깝게 못 닿는 땅볼) 후보인가 — 표 +0x178/+0x19c (P2 2a).
 * 잡는 판정은 없고 몸을 날리는 연출·길막기다 (유력).
 */
export function isDiveCandidate(input: CatchWindowInput & { readonly startedAtPlate: boolean }): boolean {
  const distance = approachedDistanceOf(input)
  return (
    input.startedAtPlate &&
    input.ball.y <= HEIGHT_WINDOW.grounder &&
    distance > DIVE_DISTANCE.minimum &&
    distance <= DIVE_DISTANCE.maximum
  )
}

/** 종류별 "가장 이른 포구 틱과 그 야수". 없으면 null */
export interface CatchOpportunity {
  readonly tick: number
  readonly slot: number
}

export interface CatchTable {
  /** +0x60 낮은 공 */
  readonly low: CatchOpportunity | null
  /** +0x84 가슴 높이 */
  readonly chest: CatchOpportunity | null
  /** +0xa8 땅볼(바운드 전 낮은 공) */
  readonly grounder: CatchOpportunity | null
  /** +0x3c 점프 */
  readonly jump: CatchOpportunity | null
  /** +0xcc 슬라이딩 */
  readonly slide: CatchOpportunity | null
}

export const EMPTY_CATCH_TABLE: CatchTable = {
  low: null,
  chest: null,
  grounder: null,
  jump: null,
  slide: null,
}

/** 표가 비었을 때 원본이 쓰는 큰 값 (0xb3b9c 의 100000) */
const NO_TICK = 100_000

export interface ChaseChoice {
  readonly kind: CatchKind
  /** 고른 야수 번호 (+0x170) */
  readonly slot: number
  /** 포구 틱 (+0x174) */
  readonly catchTick: number
  /** 동작 시작 틱 (+0x176) — 분기표 0xd87c0 */
  readonly actionStartTick: number
}

/**
 * 추적야수 고르기 0xb3b38 — 우선순위대로 한 명을 고른다.
 *
 * `nearestSlotToLowPoint` = 낮은 공 틱의 공 예측점 Q 에 가장 가까운 야수(동작 잠금이 아닌 야수 중).
 * 우선순위 1·8 이 이 야수를 쓴다.
 */
export function chooseChaser(
  table: CatchTable,
  landingTick: number,
  nearestSlotToLowPoint: number,
): ChaseChoice {
  const tickOf = (entry: CatchOpportunity | null) => (entry === null ? NO_TICK : entry.tick)
  const low = tickOf(table.low)
  const chest = tickOf(table.chest)
  const grounder = tickOf(table.grounder)
  const jump = tickOf(table.jump)
  const slide = tickOf(table.slide)

  // 1~5: 낙구 전에 잡히는 것들. 필살(점프·슬라이딩)은 보통 포구가 가능하면 쓰이지 않는다.
  if (low <= landingTick) return choiceOf(CATCH_KIND.LOW, nearestSlotToLowPoint, low)
  if (chest <= landingTick) return choiceOf(CATCH_KIND.CHEST, table.chest!.slot, chest)
  if (grounder <= landingTick) return choiceOf(CATCH_KIND.GROUNDER, table.grounder!.slot, grounder)
  // 원본은 점프·슬라이딩 가지에만 "틱이 1 이 아닐 것" 을 덧붙인다 (0xb3c6e~). 그대로 옮긴다.
  if (jump <= landingTick && jump !== 1) return choiceOf(CATCH_KIND.JUMP, table.jump!.slot, jump)
  if (slide <= landingTick && slide !== 1) return choiceOf(CATCH_KIND.SLIDE, table.slide!.slot, slide)

  // 6~8: 낙구 뒤(바운드 뒤) 잡기
  if (table.low !== null && low < chest + 2) return choiceOf(CATCH_KIND.LOW, table.low.slot, low)
  if (table.chest !== null && chest + 2 < grounder + 5) return choiceOf(CATCH_KIND.CHEST, table.chest.slot, chest)
  if (table.grounder !== null) return choiceOf(CATCH_KIND.GROUNDER, table.grounder.slot, grounder)
  return choiceOf(CATCH_KIND.LOW, nearestSlotToLowPoint, low)
}

/** 동작 시작 틱 분기표 0xd87c0: 종류0 그대로 · 1 −2 · 2 −1 · 3 −8 · 4 −6 */
export function actionStartTickOf(kind: CatchKind, catchTick: number): number {
  switch (kind) {
    case CATCH_KIND.CHEST:
      return catchTick - 2
    case CATCH_KIND.GROUNDER:
      return catchTick - 1
    case CATCH_KIND.JUMP:
      return catchTick - 8
    case CATCH_KIND.SLIDE:
      return catchTick - 6
    default:
      return catchTick
  }
}

function choiceOf(kind: CatchKind, slot: number, catchTick: number): ChaseChoice {
  return { kind, slot, catchTick, actionStartTick: actionStartTickOf(kind, catchTick) }
}

/**
 * 외야 백업 (AI 상태 0xc, 0xb4b78): 추적야수 목표 T 와 내 위치 P 의 차이가 x 또는 z 로 2000 을 넘으면
 * `T − 부호(차)×2000` 지점으로 간다.
 *
 * **원본 버그 그대로**: 조건을 `dx > 2000 || dz > 2000` 로만 보아 음수 쪽 큰 차이는 무시한다 (0xb4bae).
 */
export function backupPointOf(chaserTarget: WorldPoint, position: WorldPoint): WorldPoint | null {
  const dx = chaserTarget.x - position.x
  const dz = chaserTarget.z - position.z
  if (!(dx > 2000 || dz > 2000)) return null
  return {
    x: chaserTarget.x - Math.sign(dx) * 2000,
    y: chaserTarget.y,
    z: chaserTarget.z - Math.sign(dz) * 2000,
  }
}
