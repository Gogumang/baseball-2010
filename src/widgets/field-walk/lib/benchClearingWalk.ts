import { BASE_POSITIONS, FIELDER_START_POSITIONS } from '@/entities/fielding/model/fieldGeometry'
import type { BenchClearingEntryRoll } from '@/features/play-game/model/benchClearingScene'
import { type CameraState, cameraBoundsOf, centerOn } from '@/pages/defense/lib/defenseCamera'
import {
  type FieldWalker,
  NEW_FIELD_WALKER,
  aimWalker,
  isWalkerArrived,
  placeWalker,
  setWalkerAction,
  setWalkerAt,
  setWalkerSpeed,
  standWalker,
  stepWalker,
} from '@/widgets/field-walk/lib/fieldWalker'
import { DUGOUT_POSITIONS } from '@/widgets/field-walk/lib/halfInningWalk'
import type { WalkerAceSprite } from '@/widgets/field-walk/lib/walkerAces'

/**
 * **벤치 클리어링(상태 0x1e)의 운동장** — 진입 0x3a5f0 이 18명을 세우고, 갱신 0x405b0 이 걷게 하고 0x401d4 가 틱마다 목표 · 동작을 준다.
 * 그리기 0x43228 은 바탕 0x411e0 + 수비 줄 0x43010(+0x111c, 그림 [+0xf20]) + 공격 줄 0x43010(+0x1758, 그림 [+0x177c]) + 0xbe6a1.
 * 직접 떴다(2026-10-14):
 *
 * ## 진입 0x3a5f0
 * ```
 * 3a604  카메라 vtc(투수판 0xcfa8c[0] = (20000, 24500)) — 곧바로 그 자리. 0x1e 동안 카메라를 굴리는 곳이 없다
 * 3a616  수비 i = 8 → 0: vt10 · 자리 = 0xcfa8c[i] · 0xa21bc(0xcfa8c[i]) — 제자리에 선다(굴림 없음)
 * 3a66a  [+0x177c] 그림을 공격 팀(0xb6bf9 = st[9] 팀) 팔레트로 다시 싣는다
 * 3a722  공격 9명을 새로 만든다(0xa0e08)
 * 3a760  공격 i = 8 → 0: vt10 · 자리 = (더그아웃[st[9]].x − (scatterX + 100)(8 − i), 더그아웃.z − (scatterZ + 100)(8 − i))
 *        · 걸음 rand(200, 400) · 0xa21bc(표 칸 + (targetX, targetZ)) — 측 0 은 3루수 칸 0xcfa8c[4], 측 1 은 1루수 칸 [2]
 *        (0xa21bc 가 걸음을 220 으로 덮는다 — 굴린 걸음은 안 쓰인다, 원본 그대로)
 * 3a848  타자(공격 [8]) = 홈 0xcfb90[0] 에서 좌타(0xb63c0)면 x + 1400, 우타면 x − 1400 에 놓고(0xbef58) vt10 · vt44(3) ·
 *        0xa21bc(투수판) — 마운드로 달려 나간다
 * 3aa26  루 b = 1..3 에 주자(0xa97a1)가 있으면 공격 [8 − b] 를 그 루 0xcfb90[b] 에 놓고(0xbef58) vt10 · 0xa21bc(제자리) — 선다
 * ```
 * ## 갱신 0x405b0 → 0x401d4 (틱 = 경기+0x2c, 진입 틱이 0)
 * ```
 * i = 8 → 0: 수비 · 공격 각각 vt18(닿았나) 거짓이면 +0xac += 1 · vt24 한 걸음 (닿아도 vt10 을 안 부른다 — 동작이 그대로 남는다)
 * 틱 10   수비 목표 (P = 투수판, r1~r8 = `rollBenchClearingTargets` 차례):
 *         [8] (P.x − r1, P.z − 2500) 400 · [7] (P.x − 300, P.z − 1000) 400 · [6] (P.x + r2, P.z − 1000) 400 ·
 *         [5] (P.x − r3, P.z) 250 · [4] P 250 · [3] (P.x + 500, P.z + r4) 250 · [2] (P.x, P.z + r5) 250 ·
 *         [1] (P.x + r6, P.z + 500) 250 · [0] (2루수 칸 0xcfa8c[3].x − r7, [3].z − r8) 220
 * 틱 30   수비 동작 vt44: [8] 1 · [7] 1 · [6] 1 · [5] 4 · [4] 4 · [3] 3 · [2] 2 · [1] 2 → 0 · [0] 0
 * 틱 60   공격 [7] → [0] 을 공격 측 더그아웃으로(0xa21bc) · +0xb8 = 0 ; 타자 [8] 동작 측 0 ? 3 : 4 · +0xb8 = 10
 * 틱 70   타자 [8] 동작 측 0 ? 4 : 3 · 틱 80 측 0 ? 3 : 4
 * 틱 100  화면 전환 0xbdae8(…, 7, 0, 5, 1500) — `benchClearingIrisOf`
 * ```
 */

const SCREEN_WIDTH = 240
const SCREEN_HEIGHT = 320
const PLATE = FIELDER_START_POSITIONS[0]
/** 3a848 — 타석 자리에서 좌우 1400 (0xaf << 3 · 0xfffffa88) */
const BATTER_BOX_OFFSET = 1400
const FIELDER_COUNT = 9
const BATTER_INDEX = 8

/** 0x401d4 의 틱 */
export const BENCH_CLEARING_TICKS = { targets: 10, actions: 30, retreat: 60, lookAway: 70, lookBack: 80, transition: 100 } as const

export interface BenchClearingWalkInput {
  /** 진입 굴림 45 번 (`rollBenchClearingEntry`, 칸 i) */
  readonly entryRolls: readonly BenchClearingEntryRoll[]
  /** st[9] — 공격 측 (사구를 맞은 쪽) */
  readonly offenseSide: 0 | 1
  /** 지금 타자가 좌타인가 — 0xb63c0(0xae89c(공격 팀)) */
  readonly isLeftBatter: boolean
  /** 1 · 2 · 3루에 주자가 있나 (사구를 먹이기 앞) */
  readonly occupiedBases: readonly [boolean, boolean, boolean]
}

/** 그리기 0x43228 의 재료 — 걷기 재료와 그림 팔레트 */
export interface BenchClearingField extends BenchClearingWalkInput {
  /** 수비 팀 번호 — 수비 줄 그림 [+0xf20] 팔레트 (⚠️ 유력: 새 타석 0x48d50 의 0x47cc8 이 수비 팀으로 다시 싣는다) */
  readonly defenseTeam?: number | null
  /** 공격 팀 번호 — 공격 줄 그림 [+0x177c] 팔레트 (진입 3a6c6 0x79a54(…, 0xb6bf9(st))) */
  readonly offenseTeam?: number | null
  /** 수비 바탕 잔디 팔레트 줄 */
  readonly grassPalette?: number | null
  /** 수비 줄 · 공격 줄 칸별 마선수 그림 (0x79b48 a · b — `benchClearingFieldOf`). 안 주면 보통 그림 */
  readonly defenseAces?: readonly (WalkerAceSprite | null)[]
  readonly offenseAces?: readonly (WalkerAceSprite | null)[]
}

export interface BenchClearingWalkState {
  readonly fielders: readonly FieldWalker[]
  readonly offense: readonly FieldWalker[]
}

/** 카메라 — 진입 vtc(투수판) 그대로 선다 */
export function benchClearingCamera(): CameraState {
  return centerOn(cameraBoundsOf(SCREEN_WIDTH, SCREEN_HEIGHT), PLATE)
}

/** 진입 0x3a5f0 */
export function startBenchClearingWalk(input: BenchClearingWalkInput): BenchClearingWalkState {
  const fielders = FIELDER_START_POSITIONS.map((home) => aimWalker(placeWalker(standWalker(NEW_FIELD_WALKER), home), home))
  const dugout = DUGOUT_POSITIONS[input.offenseSide]
  // 측 0 은 3루수 칸 · 측 1 은 1루수 칸 둘레로 몰려 나온다 (3a7dc `cmp 측, #0`)
  const rally = FIELDER_START_POSITIONS[input.offenseSide === 0 ? 4 : 2]
  const offense: FieldWalker[] = []
  for (let index = FIELDER_COUNT - 1; index >= 0; index -= 1) {
    const roll = input.entryRolls[index] ?? { scatterX: 0, scatterZ: 0, speed: 0, targetX: 0, targetZ: 0 }
    const back = 8 - index
    const start = { x: dugout.x - (roll.scatterX + 100) * back, z: dugout.z - (roll.scatterZ + 100) * back }
    const walker = setWalkerSpeed(placeWalker(standWalker(NEW_FIELD_WALKER), start), roll.speed)
    offense[index] = aimWalker(walker, { x: rally.x + roll.targetX, z: rally.z + roll.targetZ })
  }
  // 타자 — 타석에서 마운드로
  const home = BASE_POSITIONS[0]
  const box = { x: home.x + (input.isLeftBatter ? BATTER_BOX_OFFSET : -BATTER_BOX_OFFSET), z: home.z }
  offense[BATTER_INDEX] = aimWalker(setWalkerAction(standWalker(setWalkerAt(offense[BATTER_INDEX], box)), 3), PLATE)
  // 루상 주자 — 그 루에 선다
  input.occupiedBases.forEach((isOccupied, baseIndex) => {
    if (!isOccupied) return
    const base = BASE_POSITIONS[baseIndex + 1]
    const index = BATTER_INDEX - 1 - baseIndex
    offense[index] = aimWalker(standWalker(setWalkerAt(offense[index], base)), base)
  })
  return { fielders, offense }
}

/** 0x405b0 의 한 사람 — 안 닿았으면 걷는다 (닿아도 서기를 안 부른다) */
function walkIfMoving(walker: FieldWalker): FieldWalker {
  return isWalkerArrived(walker) ? walker : stepWalker(walker)
}

/** 틱 30 의 수비 동작 (401d4 403a0~4043a) — [1] 은 2 를 걸었다가 곧바로 0 */
const TICK30_ACTIONS: readonly (readonly number[])[] = [[0], [2, 0], [2], [3], [4], [4], [1], [1], [1]]

/**
 * 갱신 0x405b0 한 번 (틱 t). `targetRolls` 는 틱 10 의 굴림 8 번 — 틱 10 에만 쓴다(없으면 수비 목표를 안 바꾼다).
 */
export function stepBenchClearingWalk(
  state: BenchClearingWalkState,
  tick: number,
  input: BenchClearingWalkInput,
  targetRolls: readonly number[] | null,
): BenchClearingWalkState {
  let fielders = state.fielders.map(walkIfMoving)
  let offense = state.offense.map(walkIfMoving)
  const side0 = input.offenseSide === 0
  if (tick === BENCH_CLEARING_TICKS.targets && targetRolls !== null) {
    const [r1, r2, r3, r4, r5, r6, r7, r8] = targetRolls
    const second = FIELDER_START_POSITIONS[3]
    const plan: readonly { readonly x: number; readonly z: number; readonly speed: number | null }[] = [
      { x: second.x - r7, z: second.z - r8, speed: null },
      { x: PLATE.x + r6, z: PLATE.z + 500, speed: 250 },
      { x: PLATE.x, z: PLATE.z + r5, speed: 250 },
      { x: PLATE.x + 500, z: PLATE.z + r4, speed: 250 },
      { x: PLATE.x, z: PLATE.z, speed: 250 },
      { x: PLATE.x - r3, z: PLATE.z, speed: 250 },
      { x: PLATE.x + r2, z: PLATE.z - 1000, speed: 400 },
      { x: PLATE.x - 300, z: PLATE.z - 1000, speed: 400 },
      { x: PLATE.x - r1, z: PLATE.z - 2500, speed: 400 },
    ]
    fielders = fielders.map((walker, index) => {
      const target = plan[index]
      const aimed = aimWalker(walker, target)
      return target.speed === null ? aimed : setWalkerSpeed(aimed, target.speed)
    })
  } else if (tick === BENCH_CLEARING_TICKS.actions) {
    fielders = fielders.map((walker, index) => TICK30_ACTIONS[index].reduce((current, action) => setWalkerAction(current, action), walker))
  } else if (tick === BENCH_CLEARING_TICKS.retreat) {
    const dugout = DUGOUT_POSITIONS[input.offenseSide]
    offense = offense.map((walker, index) => (index === BATTER_INDEX ? setWalkerAction(walker, side0 ? 3 : 4) : aimWalker(walker, dugout)))
  } else if (tick === BENCH_CLEARING_TICKS.lookAway || tick === BENCH_CLEARING_TICKS.lookBack) {
    const action = (tick === BENCH_CLEARING_TICKS.lookAway) === side0 ? 4 : 3
    offense = offense.map((walker, index) => (index === BATTER_INDEX ? setWalkerAction(walker, action) : walker))
  }
  return { fielders, offense }
}

/**
 * **화면 전환 종류 7** — 0xbdae8(…, 7, 0, 5, 1500) → 0xbd4b4(효과, 240, 240): 화면 크기 검정 그림을 하나 만들어 둔다.
 * 그리기 0xbd844 (점프표 0xd8c58 칸 6 = 0xbd938, 직접 뜸):
 * ```
 * bd938  0xbd5bc(효과, W/2, H/2 + [그래픽 0x1221()+0x40] + 5, 단계 +0xc)
 *        단계 > 31 이면 0xbd474(버림) · 끝(+0x10 = 2), 아니면 단계 += 1          ; 단계 0 → 32, 33 그림
 * bd5bc  단계 0 이면 안 그린다. w = 240 / 단계 · h = 240 / 단계 ; 검정 그림을 검정으로 칠하고 (255, 0, 255) 로
 *        채운 원 0x1400708(x − w/2, y − h/2, w, h, 0, 360) 을 뚫은 뒤 화면 (0, 0) 에 찍는다(0x98975)
 * ```
 * 곧 가운데 구멍만 남기고 화면이 검게 닫히는 원 닫기다 — 셋째 · 넷째 인자(5, 1500)는 종류 7 에서 안 쓴다(bdb14 가 곧장 끝으로).
 * 0x401d4 는 틱 > 100 에서 효과기가 끝(+0x10 == 2)을 세운 뒤 나간다 → 전환을 건 틱 100 의 그림이 단계 0, 틱 132 의 그림이 단계 32,
 * **틱 133 의 갱신**에서 나간다.
 * [그래픽+0x40] 세로 보정은 0 이다: 0x1221 = `[0x150000c] + 8` 이고 [0x150000c] 를 적는 곳이 바이너리에 없어 단말이 채우는 객체다.
 * 0x1221 을 부르는 함수는 모두 +0x40 을 읽기만 하고(바이너리 안 `str …, #0x40]` 를 0x1221 · 0x150000c · 0x1215 를 집은 뒤 40 명령 안에서
 * 전수로 훑음 — 0x457cc 의 것은 다른 객체 [0x1400070]), 0xba9e0 · 0x6b4d4 가 이를 화면 버퍼 줄 번호에 더한다 — 화면 버퍼 위쪽 여백이라
 * 240×320 을 꽉 채우는 웹에서는 0 이다. 같은 꼴의 객체 생성자 0x2c20 · 0x2c90(vtable 0xcba14)도 +8+0x40 을 0 으로 둔다.
 * ⚠️ 미확인: 구멍 색 (255, 0, 255) 이 0x98975 에서 투명이라는 것은 쓰임새로 본 것이다(남김 — 보정값 · 투명 처리 모두 실기 단말이
 * 넣는 값 · 함수라 바이너리 밖).
 * (원 닫기 그리기 0xbd4b4 · 0xbd5bc 는 `widgets/game-scene/lib/irisClose.ts` 가 그린다.)
 */
export const BENCH_CLEARING_IRIS_LAST_LEVEL = 32
/** 0x401d4 가 나가는 틱 — 단계 32 를 그린 다음 갱신 */
export const BENCH_CLEARING_EXIT_TICK = BENCH_CLEARING_TICKS.transition + BENCH_CLEARING_IRIS_LAST_LEVEL + 1
const IRIS_SIZE = 240
const IRIS_CENTER = { x: SCREEN_WIDTH >> 1, y: (SCREEN_HEIGHT >> 1) + 5 }

/** 틱 t 의 그림에 덮는 원 닫기 — 구멍 상자(x, y, w, h). 없으면 null (전환 앞 · 단계 0 · 끝난 뒤) */
export function benchClearingIrisOf(tick: number): { readonly x: number; readonly y: number; readonly size: number } | null {
  const level = tick - BENCH_CLEARING_TICKS.transition
  if (level <= 0 || level > BENCH_CLEARING_IRIS_LAST_LEVEL) return null
  const size = Math.trunc(IRIS_SIZE / level)
  return { x: IRIS_CENTER.x - Math.trunc(size / 2), y: IRIS_CENTER.y - Math.trunc(size / 2), size }
}
