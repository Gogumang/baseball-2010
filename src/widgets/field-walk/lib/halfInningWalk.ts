import { FIELDER_START_POSITIONS } from '@/entities/fielding/model/fieldGeometry'
import type { HalfInningFielderRoll } from '@/features/play-game/model/halfInningBoard'
import { type CameraBounds, type CameraState, cameraBoundsOf, centerOn, followCamera } from '@/pages/defense/lib/defenseCamera'
import {
  type FieldWalker,
  NEW_FIELD_WALKER,
  aimWalker,
  isWalkerArrived,
  placeWalker,
  setWalkerSpeed,
  standWalker,
  stepWalker,
} from '@/widgets/field-walk/lib/fieldWalker'

/**
 * **공수 교대 판(상태 0x18)의 운동장 전경** — 판 틱 0 의 0x3fac4 가 18명을 세우고, 매 틱 0x4f7ac 가 걷게 하고 카메라를 굴린다.
 * 그리기 0x4fb8c 는 이 상태를 그린다(`ui/HalfInningField`). 직접 떴다(2026-10-14):
 *
 * ## 0x3fac4 (갱신 0x4f928 틱 0 — 판이 서서 OK 를 기다릴 때만, `rollHalfInningFielders` 의 굴림 36 개)
 * ```
 * i = 8 → 0:  F = 수비 줄 [+0x111c + 4i] (새 수비) · O = 공격 줄 [+0x1758 + 4i] (앞 반 이닝 수비 — 더그아웃으로 들어간다)
 *   O.vt10() ; O 를 F 의 지금 자리에 놓는다(0xbee60)
 *   F 자리 x + y + z ≠ 0 → O 를 공격 측 더그아웃 0xcfaf8[st[9]] 로 보낸다(0xa21bc)
 *                     아니면 카메라 vtc(더그아웃 0xcfaf8[st[0xa]]) — 곧바로 그 자리 (경기 첫 판: 야수가 아직 안 섰다)
 *   O+0xb8 = 0 ; O 걸음 = 굴림 offenseSpeed
 *   F.vt10() ; F 자리 = (더그아웃[st[0xa]].x − (scatterX + 100)(8 − i), 0, 더그아웃.z − (scatterZ + 100)(8 − i))   (0xbee84)
 *   F 를 수비 자리 0xcfa8c[i] 로 보낸다(0xa21bc) ; F 걸음 = 굴림 fielderSpeed
 * 3fca6  주자 j 마다 [+0x113c − 4j] 를 주자 자리로 — 진입 0x3ac90 이 3아웃 뒤 주자를 지워 판이 설 때는 주자가 없다
 * 3fcf8  +0x1b74 = 0 ; 카메라 vt20(투수판 (20000, 24500 − 2000)) · 0xc0558(카메라, 1)
 * ```
 * ## 0x4f7ac (매 틱, 틱 = 경기+0x2c — 판이 선 틱이 0)
 * ```
 * 틱 ≤ 9   0xc0558(카메라, 틱) — 따라가기 % 만 바꾸고 카메라는 안 굴린다
 * 틱 ≥ 10  틱 > 100 이고 카메라가 지난 틱에 안 움직였으면(0xc05c0 = +0x28): +0x1b74 < 8 이면 +1,
 *          카메라 vt20(0xcfa8c[표 0xd044c[+0x1b74]] 의 (x, z − 2000)) · 0xc055c(+0x28 = 0, 20%)
 *          카메라 vt28 — 목표 쪽 %/틱 (축마다 걸음이 0 이면 ±1), 움직였으면 +0x28 = 1
 * i = 8 → 0:  F · O 각각 — vt18(닿았나) 거짓이면 +0xac += 1 · vt24(한 걸음), 참이면 vt10(서기)
 * ```
 * 표 0xd044c = [0, 7, 8, 6, 2, 3, 5, 4, 0] — 틱 100 뒤 카메라가 투수 → 좌익 → 중견 → 우익 → 1루 → 2루 → 유격 → 3루 → 투수 차례로
 * 야수를 하나씩 비춘다(그 야수 이름표는 `halfInningNameTagOf`).
 */

/** 화면 240×320 — 카메라 시야 */
const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320
const BOUNDS: CameraBounds = cameraBoundsOf(SCREEN_WIDTH, SCREEN_HEIGHT)

/** 더그아웃 표 0xcfaf8 — 측 0 (3루 쪽) · 측 1 (1루 쪽) */
export const DUGOUT_POSITIONS: readonly { readonly x: number; readonly z: number }[] = [
  { x: 10062, z: 30550 },
  { x: 29799, z: 30550 },
]
/** 카메라가 보는 점은 야수 자리에서 z 를 2000 뺀 곳 (3fd18 · 4f85a `0xfffff830`) */
const CAMERA_Z_LIFT = 2000
/** 틱 ≤ 9 는 따라가기 % 만 바꾼다 (4f808 `cmp 틱, #9`) */
const CAMERA_HOLD_LAST_TICK = 9
/** 틱 > 100 부터 야수를 하나씩 비춘다 (4f822 `cmp 틱, #0x64`) */
const TOUR_FROM_TICK = 100
/** 0xc055c 의 따라가기 20% */
const TOUR_FOLLOW_PERCENT = 20
/** 0xc0558(카메라, 1) — 0x3fac4 가 남기는 값 (틱 0 의 0x4f7ac 가 곧바로 0 으로 덮는다) */
const ENDING_FOLLOW_PERCENT = 1
/** 표 0xd044c — +0x1b74 칸마다 비출 수비 칸 */
export const HALF_INNING_TOUR_SLOTS: readonly number[] = [0, 7, 8, 6, 2, 3, 5, 4, 0]
/** +0x1b74 상한 (4f83a `cmp r3, #7 ; bgt`) */
const TOUR_LAST = 8
const FIELDER_COUNT = 9

export interface HalfInningWalkState {
  /** 수비 줄 [+0x111c + 4i] — 새 수비 (칸 i) */
  readonly fielders: readonly FieldWalker[]
  /** 공격 줄 [+0x1758 + 4i] — 앞 반 이닝의 수비가 더그아웃으로 들어간다 */
  readonly offense: readonly FieldWalker[]
  /** 카메라 왼쪽 위 (월드) */
  readonly camera: CameraState
  /** 카메라 목표 (가운데 맞춘 왼쪽 위) */
  readonly cameraTarget: CameraState
  /** 따라가기 % (+0x2c) */
  readonly followPercent: number
  /** 지난 vt28 에 움직였나 (+0x28) */
  readonly cameraMoved: boolean
  /** +0x1b74 — 표 0xd044c 칸 */
  readonly tour: number
}

export interface HalfInningWalkInput {
  /** 판 틱 0 의 굴림 (`rollHalfInningFielders`, 칸 i) */
  readonly rolls: readonly HalfInningFielderRoll[]
  /** st[9] — 이번 반 이닝 공격 측 (0 초 · 1 말) */
  readonly offenseSide: 0 | 1
  /**
   * 판이 서기 전 수비 줄(+0x111c)의 자리 — 앞 장면이 남긴 그대로(`lib/fieldCarry`: 0x17 이 끝난 자리 · 앞 판이 닫힌 틱 · 벤치 클리어링).
   * null 이면 아직 한 번도 안 선 것 — 생성자 그대로 (0, 0, 0)이다(경기 첫 판). 높이 y 는 합 검사에만 든다.
   */
  readonly previousFielders: readonly { readonly x: number; readonly y?: number; readonly z: number }[] | null
  /**
   * 판이 서기 전 카메라 왼쪽 위 — 앞 장면이 남긴 그대로(`lib/fieldCarry`). 자리 합이 0 인 칸이 있으면 0x3fac4 가 더그아웃으로 곧바로
   * 옮기므로 안 본다. 안 주면(부르는 쪽이 카메라를 안 들고 있을 때) 이 판의 목표(투수판)에서 시작한다.
   */
  readonly previousCamera?: CameraState | null
}

/** 3fb7c~3fba4 — O(= F 의 지금 자리) 의 x + y + z == 0 */
const isZeroPoint = (point: { readonly x: number; readonly y?: number; readonly z: number }) => point.x + (point.y ?? 0) + point.z === 0

/** 0x3fac4 — 판 틱 0 의 세우기 (그 틱의 0x4f7ac 앞) */
export function startHalfInningWalk(input: HalfInningWalkInput): HalfInningWalkState {
  const defenseSide = input.offenseSide === 0 ? 1 : 0
  const offenseDugout = DUGOUT_POSITIONS[input.offenseSide]
  const defenseDugout = DUGOUT_POSITIONS[defenseSide]
  const plate = FIELDER_START_POSITIONS[0]
  const fielders: FieldWalker[] = []
  const offense: FieldWalker[] = []
  let camera: CameraState | null = input.previousCamera ?? null
  for (let index = FIELDER_COUNT - 1; index >= 0; index -= 1) {
    const roll = input.rolls[index] ?? { offenseSpeed: 0, scatterX: 0, scatterZ: 0, fielderSpeed: 0 }
    const previous = input.previousFielders?.[index] ?? { x: 0, y: 0, z: 0 }
    let walker = placeWalker(standWalker(NEW_FIELD_WALKER), { x: previous.x, z: previous.z })
    if (!isZeroPoint(previous)) {
      walker = aimWalker(walker, offenseDugout)
    } else {
      // 카메라 vtc — 가운데 맞춘 목표로 곧바로
      camera = centerOn(BOUNDS, defenseDugout)
    }
    offense[index] = setWalkerSpeed(walker, roll.offenseSpeed)
    const back = 8 - index
    const start = {
      x: defenseDugout.x - (roll.scatterX + 100) * back,
      z: defenseDugout.z - (roll.scatterZ + 100) * back,
    }
    const home = FIELDER_START_POSITIONS[index]
    const fielder = aimWalker(placeWalker(standWalker({ ...NEW_FIELD_WALKER, x: previous.x, z: previous.z }), start), home)
    fielders[index] = setWalkerSpeed(fielder, roll.fielderSpeed)
  }
  const cameraTarget = centerOn(BOUNDS, { x: plate.x, z: plate.z - CAMERA_Z_LIFT })
  return {
    fielders,
    offense,
    camera: camera ?? cameraTarget,
    cameraTarget,
    followPercent: ENDING_FOLLOW_PERCENT,
    cameraMoved: false,
    tour: 0,
  }
}

/** 0x4f7ac 의 한 사람 — 안 닿았으면 걷고, 닿았으면 서기 */
function walkOrStand(walker: FieldWalker): FieldWalker {
  return isWalkerArrived(walker) ? standWalker(walker) : stepWalker(walker)
}

/** 갱신 0x4f7ac 한 번 (틱 = 경기+0x2c) */
export function stepHalfInningWalk(state: HalfInningWalkState, tick: number): HalfInningWalkState {
  let { camera, cameraTarget, followPercent, cameraMoved, tour } = state
  if (tick <= CAMERA_HOLD_LAST_TICK) {
    followPercent = tick
  } else {
    if (tick > TOUR_FROM_TICK && !cameraMoved) {
      if (tour < TOUR_LAST) tour += 1
      const slot = HALF_INNING_TOUR_SLOTS[tour]
      const home = FIELDER_START_POSITIONS[slot]
      cameraTarget = centerOn(BOUNDS, { x: home.x, z: home.z - CAMERA_Z_LIFT })
      followPercent = TOUR_FOLLOW_PERCENT
    }
    const next = followCamera(camera, cameraTarget, followPercent)
    cameraMoved = next.x !== camera.x || next.y !== camera.y
    camera = next
  }
  return {
    fielders: state.fielders.map(walkOrStand),
    offense: state.offense.map(walkOrStand),
    camera,
    cameraTarget,
    followPercent,
    cameraMoved,
    tour,
  }
}

/** 판이 선 뒤 틱 t 의 그림 — 0x3fac4 와 틱 0..t 의 0x4f7ac 를 지난 상태 */
export function halfInningWalkAt(input: HalfInningWalkInput, tick: number): HalfInningWalkState {
  let state = startHalfInningWalk(input)
  for (let t = 0; t <= tick; t += 1) state = stepHalfInningWalk(state, t)
  return state
}

/** 이름표를 붙일 수비 칸 — 틱 > 100 일 때만 (4fbf6 `cmp 틱, #0x64 ; bgt`), 표 0xd044c[+0x1b74] */
export function halfInningNameTagSlotOf(state: HalfInningWalkState, tick: number): number | null {
  if (tick <= TOUR_FROM_TICK) return null
  return HALF_INNING_TOUR_SLOTS[state.tour] ?? null
}
