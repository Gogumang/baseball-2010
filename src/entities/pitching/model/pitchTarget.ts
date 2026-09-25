import type { RandomPort } from '@/shared/api/random/randomPort'
import { randomIntegerBelow } from '@/shared/lib/random/originalRandom'
import { cosineSixteen, sineSixteen } from '@/shared/lib/math/originalTrigonometry'
import { PLATE_DEPTH, ZONE_CENTERS } from '@/entities/pitching/model/pitchCurve'
import type { WorldPoint } from '@/entities/pitching/model/pitchCurve'
import { MISSION_AIM_CLAMP, MISSION_AIM_SHAKES } from '@/shared/config/original/missions'

/**
 * CPU 목표점 (0x345fc) 과 제구 오차 (0x4dc78) — 위치 분석 2·5차, 난수 순서까지 원본 그대로.
 * rand(a, b) = [a, b) 정수. rand01 = rand(0, 2), 0 이면 + 방향.
 */
export interface TargetSituation {
  /** 화면 배치 side (존 중심 표 0xcfbcc 의 칸) */
  readonly side: number
  readonly batterSide: number
  readonly runnerCount: number
}

const INNER = 141
const EDGE_X = [141, 332]
const EDGE_Y = [141, 330]
const CORNER_X = [282, 332]
const CORNER_Y = [280, 330]
const OUTSIDE_X = [332, 382]
const OUTSIDE_Y = [330, 380]
/**
 * 목표 종류 4 = **투구가 아니라 견제다** (0x34848, 직접 뜬 것 — 확정).
 *
 * 앞 주석은 "원본이 견제구를 던지지만 웹에는 견제가 없어 1 로 둔다 (추정)" 였는데, 그 "추정" 부분이
 * 틀렸다. 점프표 `0xcfd94`[4] = `0x34848` 가지는 **목표점을 아예 만들지 않는다**:
 * ```
 * 34848: movs r1,#4 ; movs r0,#1 ; bl rand(0xbfa54)      ; ★ 루 = rand(1, 4)  → 1·2·3
 * 34852: r0 = [장면+0x20c]            ; 주자관리
 * 3485c: bl 0xa9878(주자관리, 루)      ; 그 루에 주자가 있나
 * 34864: beq 0x34848                  ; ★ 없으면 **다시 굴린다** (루프)
 * 34866: r0 = [1552d0c]              ; 경기 상태
 * 3486c: r3 = state[0xa]             ; 측
 * 34876: r3 = [장면 + r3*4 + 0xfa0] ; r0 = [r3+4]
 * 3487c: movs r1,#0x10 ; movs r3,#0  ; bl 0xbfbac(수신처, 0x10, 루, 0)   ; ★ 메시지 0x10 = 견제
 * 34886: b 0x348d6                    ; 그대로 끝 — 공을 안 던진다
 * ```
 * 곧 CPU 도 **사람과 똑같은 메시지 0x10 경로**(0x50f28 → 플레이 종류 4 · state[0x27] = 루 · 상태 0x17)로
 * 견제를 건다. 0x34684 의 `종류 4 && (주자 0명 || 만루) → 1` 갈림이 있는 것도 이 때문이다 —
 * 주자가 없으면 위 루프가 영영 안 끝난다.
 *
 * 가중치표(`pitchPatterns`)의 다섯째 칸 w4 가 **주자열 1·2 에서 3, 주자열 3(주자 없음)에서 0** 인 것도
 * 같은 말이다: **주자가 있을 때 투구의 3% 가 견제**다.
 *
 * ⚠️ **웹은 아직 이 갈래가 없다** — 아래 `pitchTargetOf` 는 종류 4 를 종류 1(모서리)로 떨어뜨려
 * **원본이 굴리지 않는 목표점 난수 4 번을 굴리고, 원본이 던지지 않는 공을 던진다.**
 * 바로잡으려면 부르는 쪽(`selectPitch` → `widgets/batting-stage` · `features/play-team-game`)이
 * "이 투구는 견제다" 로 갈라져 수비 화면(플레이 종류 4)을 열어야 하는데, 그 파일들이 이 작업의
 * 구역 밖이라 **여기서는 고르는 함수(`cpuPickoffBaseOf`)만 원본대로 두고 배선은 남겨 둔다.**
 * `pitchTargetOf` 의 동작은 한 톨도 안 건드렸다 — 난수 차례가 지금까지와 같아야 해서다.
 */
const PICKOFF_KIND = 4
const FULL_BASES = 3
const FLIP_CHANCE = 3
const PICKOFF_BASE_LOW = 1
const PICKOFF_BASE_HIGH = 4

const signed = (random: RandomPort, value: number) => (randomIntegerBelow(random, 0, 2) === 0 ? value : -value)

/**
 * 목표 종류 4 가 **정말로 견제로 가는가** — 0x34684~0x3469a 의 갈림 그대로.
 * 주자가 없거나 만루면 종류 1(모서리 투구)로 내려앉고, 그 밖(주자 1·2명)일 때만 견제다.
 */
export function isCpuPickoff(kind: number, situation: Pick<TargetSituation, 'runnerCount'>): boolean {
  return (
    kind === PICKOFF_KIND && situation.runnerCount !== 0 && situation.runnerCount !== FULL_BASES
  )
}

/**
 * CPU 가 견제할 루 (0x34848) — `rand(1, 4)` 를 **그 루에 주자가 있을 때까지 다시 굴린다**.
 * 원본에 종료 조건이 없는 `do { } while` 이라, 주자가 하나도 없으면 영영 안 끝난다 — 그래서
 * 부르기 전에 `isCpuPickoff` 로 걸러야 한다(원본 0x34684 갈림과 같은 자리).
 *
 * 돌려주는 루를 그대로 `entities/defense-controls/model/pickoff.pickoffPlayOf` 에 넣으면
 * 사람 견제('3'/'1'/'7' → 0x53548)와 **같은 메시지 0x10 경로**가 된다.
 */
export function cpuPickoffBaseOf(
  hasRunnerOnBase: (base: number) => boolean,
  random: RandomPort,
): 1 | 2 | 3 {
  // 원본에는 없는 안전망 — 부르는 쪽이 `isCpuPickoff` 를 안 걸렀을 때 무한 루프를 막는다
  for (let guard = 0; guard < 1000; guard += 1) {
    const base = randomIntegerBelow(random, PICKOFF_BASE_LOW, PICKOFF_BASE_HIGH)
    if (hasRunnerOnBase(base)) return base as 1 | 2 | 3
  }
  throw new Error('cpuPickoffBaseOf: 주자가 있는 루가 없다 — isCpuPickoff 로 먼저 걸러야 한다')
}

export function pitchTargetOf(kind: number, situation: TargetSituation, random: RandomPort): WorldPoint {
  const center = ZONE_CENTERS[situation.side] ?? ZONE_CENTERS[0]
  // 종류 4 는 주자가 없거나 만루면 1 이다 (0x34684). 그 밖은 원본이 **투구를 안 하고 견제로 빠지는데**
  // (0x34848, 위 주석) 웹에는 그 갈래가 없어 여기서는 종류 1 로 둔다 — **알려진 어긋남**이다
  const effective =
    kind === PICKOFF_KIND && (situation.runnerCount === 0 || situation.runnerCount === FULL_BASES) ? 1 : kind
  switch (effective) {
    case 0: {
      const x = center.x + randomIntegerBelow(random, -INNER, INNER)
      const y = center.y + randomIntegerBelow(random, -INNER, INNER)
      return { x, y, z: PLATE_DEPTH }
    }
    case 2:
    case 1:
    case PICKOFF_KIND: {
      const [minimumX, maximumX] = effective === 2 ? CORNER_X : EDGE_X
      const [minimumY, maximumY] = effective === 2 ? CORNER_Y : EDGE_Y
      const dx = randomIntegerBelow(random, minimumX, maximumX)
      const dy = randomIntegerBelow(random, minimumY, maximumY)
      const x = center.x + signed(random, dx)
      const y = center.y + signed(random, dy)
      return { x, y, z: PLATE_DEPTH }
    }
    default: {
      const dx = randomIntegerBelow(random, OUTSIDE_X[0], OUTSIDE_X[1])
      const dy = randomIntegerBelow(random, OUTSIDE_Y[0], OUTSIDE_Y[1])
      let direction = situation.batterSide === 0 ? 1 : -1
      if (randomIntegerBelow(random, 0, FLIP_CHANCE) === 0) direction = -direction
      const y = center.y + signed(random, dy)
      return { x: center.x + dx * direction, y, z: PLATE_DEPTH }
    }
  }
}

/** 등급별 누적 % (표 0xcfd60) → 계수 칸 */
const ERROR_ROWS: readonly (readonly number[])[] = [
  [10, 35, 80, 100],
  [40, 65, 90, 100],
  [50, 73, 93, 100],
  [60, 80, 95, 100],
  [72, 87, 97, 100],
  [84, 94, 99, 100],
]
const ERROR_COEFFICIENTS = [12, 20, 25, 30]
/** slt_pitch 프레임 59~67 의 반폭 — 조준 칸 크기 */
const AIM_HALF_WIDTHS = [21, 20, 18, 16, 14, 12, 10, 8, 6]
const COMPUTER_AIM_OFFSET = 3
const SIXTEEN_BITS = 16

/**
 * **투수 미션 조준점 흔들림** (0x39c5c — E-defense-rules.md E-7 · 4a, 확정).
 *
 * 원본은 투수 미션(화면 모드 5)에서 **조준하는 매 틱**에 조준점을 존 중심 기준
 * x ±600 · y ±400 으로 자른 뒤, 미션 레코드 바이트 13(`missions.ts` 의 `conditionCode`) 에 따라
 * 흔든다. 세기별 값은 `MISSION_AIM_SHAKES` 에 있다.
 *
 * ⚠️ **근사 한 군데**: 웹판에는 조준 틱이 없다 — 사람 투구는 3×3 코스 칸을 골라 한 번에 던진다
 *    (`features/play-pitcher-game` 의 `courseTargetOf`). 그래서 매 틱이 아니라 **던질 때 한 번**만
 *    흔든다. 자르기 → 흔들기 순서와 난수 차례는 원본 틱 하나와 같다.
 *
 * 흔들고 난 값은 원본도 다시 자르지 않는다 (다음 틱에서야 잘린다) — **원본 그대로 두었다**.
 */
export function applyMissionAimShake(
  aim: WorldPoint,
  conditionCode: number,
  side: number,
  random: RandomPort,
): WorldPoint {
  const center = ZONE_CENTERS[side] ?? ZONE_CENTERS[0]
  const clamp = (value: number, middle: number, half: number) =>
    Math.max(middle - half, Math.min(middle + half, value))
  let x = clamp(aim.x, center.x, MISSION_AIM_CLAMP.x)
  let y = clamp(aim.y, center.y, MISSION_AIM_CLAMP.y)

  const shake = MISSION_AIM_SHAKES[conditionCode] ?? null
  if (shake === null) return { x, y, z: aim.z }
  // 원본은 `rand(0,100) <= 50` 이라 51% 다 (⚠️ 원본 그대로)
  if (randomIntegerBelow(random, 0, 100) > shake.chancePercent) return { x, y, z: aim.z }

  if (shake.teleport) {
    x = randomIntegerBelow(random, center.x - shake.shakeX, center.x + shake.shakeX)
    y = randomIntegerBelow(random, center.y - shake.shakeY, center.y + shake.shakeY)
    return { x, y, z: aim.z }
  }
  x += randomIntegerBelow(random, -shake.shakeX, shake.shakeX)
  // 세기 1 은 가로만 흔든다 (shakeY = 0 이라 난수도 뽑지 않는다 — 원본도 세로 갈래를 건너뛴다)
  if (shake.shakeY !== 0) y += randomIntegerBelow(random, -shake.shakeY, shake.shakeY)
  return { x, y, z: aim.z }
}

export interface ControlErrorInput {
  /** 제구 등급 0~5 (0xb74bc) */
  readonly tier: number
  readonly isComputer: boolean
  /** 사용자 투구의 조준 칸 (게이지). CPU 는 등급 + 3 */
  readonly aimIndex?: number
  /**
   * **투수 미션 조준 흔들림** — `missions.ts` 의 `conditionCode` 0~3 과 존 중심을 고르는 배치 side.
   * 안 넘기거나 `conditionCode` 가 0 이면 흔들지 않는다 = 지금까지와 똑같이 논다 (0x39c5c).
   */
  readonly missionAim?: { readonly conditionCode: number; readonly side: number }
}

export function applyControlError(target: WorldPoint, input: ControlErrorInput, random: RandomPort): WorldPoint {
  // 원본 차례대로 조준 흔들림(0x39c5c, 조준 중)이 먼저고 제구 흩어짐(0x4dc78, 던질 때)이 나중이다
  const aim =
    input.missionAim === undefined || input.missionAim.conditionCode === 0
      ? target
      : applyMissionAimShake(target, input.missionAim.conditionCode, input.missionAim.side, random)
  const row = ERROR_ROWS[Math.max(0, Math.min(input.tier, ERROR_ROWS.length - 1))]
  const aimIndex = input.isComputer ? input.tier + COMPUTER_AIM_OFFSET : (input.aimIndex ?? 0)
  const roll = randomIntegerBelow(random, 0, 100)
  const column = row.findIndex((percent) => roll < percent)
  const coefficient = ERROR_COEFFICIENTS[column < 0 ? ERROR_COEFFICIENTS.length - 1 : column]
  const half = input.tier === 0 ? AIM_HALF_WIDTHS[0] : AIM_HALF_WIDTHS[Math.min(aimIndex, AIM_HALF_WIDTHS.length - 1)]
  const angle = randomIntegerBelow(random, 0, 360) + 1
  const dx = Math.abs(coefficient * ((half + randomIntegerBelow(random, -2, 3)) * sineSixteen(angle))) >> SIXTEEN_BITS
  const dy = Math.abs(coefficient * ((half + randomIntegerBelow(random, -2, 3)) * cosineSixteen(angle))) >> SIXTEEN_BITS
  const x = randomIntegerBelow(random, 0, 2) !== 0 ? aim.x - dx : aim.x + dx
  const y = randomIntegerBelow(random, 0, 2) !== 0 ? aim.y - dy : aim.y + dy
  return { x, y, z: aim.z }
}
