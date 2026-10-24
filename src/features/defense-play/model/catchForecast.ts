import type { BattedBallTrajectory, CatchTable, CatchOpportunity, ChaseChoice } from '@/entities/fielding/model/catchPrediction'
import {
  approachedDistanceOf,
  CATCH_KIND,
  catchKindsAt,
  chooseChaser,
  DIVE_DISTANCE,
  EMPTY_CATCH_TABLE,
  HEIGHT_WINDOW,
} from '@/entities/fielding/model/catchPrediction'
import { horizontalDistance, isOutfieldSlot, stepToward, type WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import type { FielderState } from '@/entities/fielding/model/fieldingState'
import { POSE, isFreezeOpen, shouldClearPose, withThrowMotion } from '@/entities/fielding/model/fielderPose'

/**
 * 포구 예보 — 타구가 떠난 순간 "누가 몇 틱에 잡는가" 를 한 번에 정한다.
 *
 * 원본 0xb12d0 은 야수 9명을 **복제해**(new 0xf4 + 0xa0e08 + 0xf4 바이트 통째 복사 — 위치 · 동작 잠금 +0xb4 · +0xcc 까지)
 * 궤적 점마다 굴려 보고 종류별 가장 이른 포구 틱 표를 만든다 (P2 2a). 직접 뜬 틱 루프:
 * ```
 * b13b2  t = 1 → ; P(t) = 0xa25b0(공, min(t, 공+0x6c − 1))     ; 궤적 끝을 넘으면 마지막 점(멈춘 공)을 계속 본다
 * b13e4  j == 추적야수(+0x130) && t ≤ 4 → 건너뜀(b1840 — 복제 틱도 안 돈다)
 * b1410  움직임허용[j](a == 1 이면 모두) :
 * b1416    +0x127 && 공+0xaa0 ≥ t → 복제.vt14(P(aa0)) — 낙구 지점(x, 0, z)으로 실제로 달린다 (정지 아님)
 * b1452    아니면 정지 = 1 ; n[j]++
 * b146c  복제.vtc8()(0xa2118 = +0xb1 == 0 && +0xcc ≤ 0) && 복제+0xb4 ≤ 0 이 아니면 →
 * b148e    정지면 n[j]−− (그 틱은 안 뛴 것으로) ; 복제.vt0c() ; 다음 야수          ; 판정 없음
 * b14d0  정지면 복제.vt10()(0xa124c → 0xbf2b0 목표 = 위치 · 멈춤) ; 판정(d = 거리 − 220 × n[j] · 정지일 때만 뺀다)
 * b17fc  복제.vt0c() = 야수 틱 0xa1284 — +0xb4 > 0 이면 −1(0 이 되면 vt10)만 하고 끝, 아니면 +0xcc −1 · 이동(0xbf094)
 * b185e  +0x11c ≤ 0xfffe 면 남은틱−− ; 0 이면 끝. t 는 궤적 끝에서 멈추지 않는다(a == 1 — 0xb18bc t++)
 * ```
 * 그래서 n 은 "판정받은 틱 수" 다 — 추적야수가 건너뛴 4틱과 동작 잠금 틱은 세지 않는다. 낙구 지점으로 달리는 동안(+0x127)도
 * 안 센다. 거리 `d` 가 정해지고 나서야 포구 반경 `R = (칸 ≤ 5) ? 500 : 300` · 땅볼 반경 1000 · 점프 상자 ±299 ·
 * 슬라이딩 창 `1999 < d ≤ 3000` 이 갈린다.
 *
 * **웹 다리**: `window` — 원본은 틱 구간을 자르지 않는다. 웹은 타자주자의 운명을 결과 코드가 먼저 정하므로 구간 밖 틱은
 * **판정만** 안 적는다(복제의 n · 잠금 · 이동은 t = 1 부터 원본대로 돈다).
 * **복제의 목표점(+0x2c)** 은 진짜 야수에게서 물려받아 복제마다 따로 둔다(r158) — 바꾸는 곳은 셋뿐이다:
 * 낙구 달리기 b1416 의 vt14(0xa14c8 — +0xb4 ≤ 0 · vtc8 일 때만 받는다) · 정지 판정 b14d0 의 vt10 · 복제 틱 0xa1284 의
 * vt10(잠금 +0xb4 가 0 이 된 틱 a12c8 · 던진 뒤 +0xb1 을 푼 a143e). 걸음(a1376 0xbf094)은 그 목표로 간다 — 움직임허용이 아닐 때
 * (송구 0xb2e38 의 vt24(0) · 공+0xaac == 0) 커버가 물려받은 루로 달려가 받는 것도, +0xcc 가 a1330 에서 막 0 이 된 틱에 vtc8 이
 * 열려 그때의 목표로 한 걸음 가는 것도 이 한 칸으로 원본대로 된다. (+0xcc 를 세우는 곳은 vt8c 0xa0ee0 — AI 0xf b4c52 의
 * vt8c(5) — 와 판 시작의 0 쓰기 b1156(vt20 인자 ≠ 0) · 생성자 a0df0 뿐이다(b0fa6 의 0xb0f88 은 부르는 곳이 없다). AI 0xf 는 사건
 * 7 · 12 뒤라(r190) 그 판에서는 예보가 다시 돌지 않고, 다음 판이 vt20(0)(폭투 · 견제 · 도루)이면 남은 4~5 가 복제에 실린다 —
 * 웹은 판 사이 야수 칸을 넘기지 않아 늘 0 이다(⚠️ `stealPlay` 머리말))
 */

/** 표를 만들 때 살펴볼 최대 틱 — 원본은 끝이 없다(첫 포구 가능 틱 뒤 5틱에서 끝). n 이 쌓여 그 전에 늘 누군가 닿는다 */
const FORECAST_TICKS = 200

/** 첫 포구 가능 틱(+0x11c)이 잡힌 뒤 더 보는 틱 수 — 원본 `남은틱 = 5` (0xb185e) */
const EXTRA_TICKS_AFTER_FIRST = 5

export interface CatchForecast {
  readonly table: CatchTable
  readonly choice: ChaseChoice
  /** 표 전체에서 가장 이른 포구 틱 (플레이 +0x11c). 없으면 0xffff */
  readonly earliestCatchTick: number
  /** 포구 지점 */
  readonly point: WorldPoint
  /**
   * **담장 갈래 0xb3e5c~0xb3ebc** — 공이 담장선을 먼저 넘으면(공+0xaa4 ≠ −1 && aa4 < min(땅볼, 가슴, 낮은 공 틱)) 고른 야수는
   * AI 0xb 로 공점(aa4 − 2)의 (x, 0, z) 에 간다(+0x90). 점프 · 슬라이딩 틱은 최소에 안 든다. 아니면 null
   */
  readonly fenceChasePoint: WorldPoint | null
  /**
   * 두 번째 패스(b1878)로 넘어갔나 — 그 자리 b188a~b1892 가 **공 가진 야수(+0x130, 0xb0c90)의 +0xc0 = 4** 를 적는다.
   * 그림 0x438c4 의 "!"(애니 13)만 본다. `secondPass` 를 안 준 예보(a = 1)는 늘 거짓
   */
  readonly secondPassStarted: boolean
  /**
   * **다이빙 후보 틱 +0x178[칸]** (b15e4~b1642, 직접 뜬 것 — r180): 예보 머리 b130c~b1334 가 아홉 칸을 1000(+0x19c 거리는 9999)으로
   * 채우고, 판정 갈래(잠금 · vtc8 관문 뒤 b14d0)에서 `공 첫 점 0xa25b0(공, 0) == 0xd8758 (20000, 1000, 30000)`(0xbc0f4 — 세 칸 같음) &&
   * h ≤ 500 && 1000 < d ≤ 2000 && d < +0x19c[칸] 이면 +0x178[칸] = t · +0x19c[칸] = d (d 는 포구 판정과 같은 값 — 정지면 220 × n 을 뺀 것).
   * 판정보다 앞이라 +0x1e8(지정 야수) 모드에 안 닫힌다. 웹 틱 구간(`window`)과도 상관없다. 없으면 1000 — `DIVE_TICK_NONE`
   */
  readonly diveTicks: readonly number[]
  /**
   * **고르기 0xb3b38 의 백업 갈래 b3ebe~b3f62** (직접 뜬 것, r180): 담장 갈래(`fenceChasePoint`)가 아니고 고른 야수가 외야(칸 6~8 —
   * 0xb8da8 `+0x88 − 6 ≤ 2`)면, 칸 5~8 중 외야이고 고른 야수가 아닌 야수 가운데 위치(+0x20)와 낮은 공 점 Q(sp+0x74 — `nearestSlotTo`
   * 의 점) 거리(0xbfa2c)가 가장 짧은(처음 최소 400000, `<`) 야수 하나를 AI 0xc(백업)로. 없으면 −1. 목표는 안 바꾼다 —
   * AI 고리 b4b78 이 매 틱 정한다(`backupPointOf`)
   */
  readonly backupSlot: number
}

/** +0x178[칸] 의 빈 값 (b1314 `#0xfa << 2`) — AI 고리 b46fa 가 1000 이면 다이빙 검사를 건너뛴다 */
export const DIVE_TICK_NONE = 1000
/** +0x19c[칸] 의 첫 값 (b1330 0x270f) */
const DIVE_DISTANCE_START = 9999

/** 아무도 못 잡을 때 원본이 쓰는 큰 값 (플레이 +0x11c 초기값) */
const NO_CATCH_TICK = 0xffff

export interface CatchForecastOptions {
  /** 필살 점프 창 (플레이 +0x1f5) — `rollSpecialDefense` 의 A 굴림이 성공했을 때만 선다 */
  readonly jumpUnlocked?: boolean
  /** 필살 슬라이딩 창 (플레이 +0x1f6) — B 굴림 */
  readonly slideUnlocked?: boolean
  /** 지정 야수만 잡게 하는 모드 (플레이 +0x1e8 · +0x154) */
  readonly onlySlot?: number
  /**
   * 표를 만들 때의 추적야수 +0x130 — **타구 시작(0xb280a)에서는 1(포수)** 이고,
   * 원본은 그 야수만 `t ≤ 4` 동안 건너뛴다 (P2 2a `if j == 추적야수 && t ≤ 4 : 건너뜀`).
   * 그 가드가 "포수가 홈플레이트 위 타구를 그 자리에서 주워 버리는 것" 을 막는다.
   */
  readonly initialChaserSlot?: number
  /**
   * **플레이 +0x127** — 타구 시작 0x51408 이 0 으로 비운 뒤 뽑은 패턴이 `0xb07c8 == 1`(패턴 플래그 비트 1)이면 세운다
   * (0x514e6), 쥐기 0xb2710 이 지운다. 서 있으면 낙구 틱까지 복제가 낙구 지점으로 **실제로 달린다**(b1416).
   */
  readonly chaseToLanding?: boolean
  /**
   * **인자 a = 0** (송구 0xb2e38 의 vt24(0), b307c) — 움직임허용[j] = `a ≠ 0 || 공+0xaac ≠ 0`(b1376~b138c)이고,
   * 궤적 끝(t == 공+0x6c, b1878)까지 남은틱이 안 끝나면 두 번째 패스: 추적야수 +0xc0 = 4 · 공+0xaac = 1 · a = 1 ·
   * 움직임허용 모두 1 · **t = 10 부터 다시**(n · 복제 · 표는 그대로, b1888~b18ba). 안 주면 a = 1(타구 · 다시 쏘기).
   */
  readonly secondPass?: { readonly movable: boolean }
  /**
   * 방금 던진 야수 — 던지기 0xa1620 끝(a1a3a)이 +0xb1 = 1 을 세워 복제의 vtc8 이 거짓이다. 야수 틱 0xa1284 는 동작(+0xa8)이
   * 14~18 이 아니면 a1406~a141a 에서 `vtc8()` 이 거짓일 때 곧장 a143e 로 가 +0xb0~+0xb3 을 지우고 vt10(0xa124c — 목표 = 위치 ·
   * 동작 0)을 부른다. 이동(a1346)은 그 앞이라 **첫 복제 틱**은 판정도 걸음도 없고, 둘째 복제 틱부터 풀린다(U-78, 에뮬 확인 —
   * 동작 5 · +0xac 0 · +0xb1 1 로 한 번 돌리면 +0xb1 = 0 · 동작 0 · 위치 그대로). +0xac == 2(a13ae)는 잠기지 않은 야수의 갈래다.
   * vt10 이 복제 목표를 제 위치로 두므로 움직임허용이 아닌 패스에서 던진 야수의 복제는 그 뒤 제자리다.
   */
  readonly thrownSlot?: number
}

/** b18b6 — 두 번째 패스는 t = 10 부터 */
const SECOND_PASS_FIRST_TICK = 10

/** 추적야수를 건너뛰는 구간 (P2 2a) */
const CHASER_SKIP_TICKS = 4
/** 원본 틱 루프는 1 부터 돈다 (t = 1 → tmax) */
const FIRST_FORECAST_TICK = 1

/**
 * @param window 판정을 적을 틱 구간. 뜬공(잡히는 타구)은 `[0, 낙구 틱]`, 굴러간 타구는 `[낙구 틱, ∞)` 를 본다.
 *   구간을 밖에서 주는 이유는 **타자주자의 운명이 결과 코드로 이미 정해져 있기 때문**이다 (위 웹 다리).
 * @param options 필살수비 굴림(0x66b30 / 0x66be4)이 연 창 · 추적야수 · +0x127.
 */
export function forecastCatch(
  trajectory: BattedBallTrajectory,
  fielders: readonly FielderState[],
  window: { readonly from: number; readonly to: number },
  options: CatchForecastOptions = {},
): CatchForecast {
  const table: { -readonly [K in keyof CatchTable]: CatchOpportunity | null } = { ...EMPTY_CATCH_TABLE }
  const keyOf: Readonly<Record<number, keyof CatchTable>> = {
    [CATCH_KIND.LOW]: 'low',
    [CATCH_KIND.CHEST]: 'chest',
    [CATCH_KIND.GROUNDER]: 'grounder',
    [CATCH_KIND.JUMP]: 'jump',
    [CATCH_KIND.SLIDE]: 'slide',
  }

  const last = Math.min(window.to, FORECAST_TICKS)
  const initialChaserSlot = options.initialChaserSlot ?? 1
  const landing = trajectory.pointAt(trajectory.landingTick)
  // vt14 → 0xa100c(야수, x, 0, z) — 낙구 지점의 높이는 버린다
  const landingTarget: WorldPoint = { x: landing.x, y: 0, z: landing.z }
  // 복제 9명 — 위치 · n · 동작 잠금 +0xb4 · +0xcc 를 원본 복제처럼 따로 굴린다
  // 자세 워드 +0xb0 · 동작 +0xa8 · 프레임 +0xac 도 베낀다(r171 — 복제 틱이 원본 야수 틱 0xa1284 를 통째로 돈다, `fielderPose`).
  // 던진 야수(`thrownSlot`)는 던지기 끝(a1a26~a1a3a)의 동작 5 · +0xb1 을 얹는다 — 진행기가 이미 세웠으면 같은 값이다
  const clones = fielders.map((fielder): ForecastClone => {
    const thrown = fielder.slot === options.thrownSlot ? withThrowMotion(fielder) : fielder
    return {
      position: fielder.position,
      runTicks: 0,
      lockTicks: fielder.actionLockTicks,
      slackTicks: fielder.arrivalSlackTicks,
      pose: thrown.pose,
      action: thrown.action,
      frame: thrown.actionFrame,
      target: fielder.target,
    }
  })
  // 움직임허용 — a = 1 이면 모두. a = 0 이면 공+0xaac(악송구 · 원바운드 송구)일 때만
  let movable = options.secondPass === undefined ? true : options.secondPass.movable
  let firstPass = options.secondPass !== undefined
  let remainingTicks = EXTRA_TICKS_AFTER_FIRST
  const diveTicks = fielders.map(() => DIVE_TICK_NONE)
  const diveDistances = fielders.map(() => DIVE_DISTANCE_START)
  for (let tick = FIRST_FORECAST_TICK; tick <= last; tick += 1) {
    const ball = trajectory.pointAt(tick)
    const recording = tick >= window.from
    for (const [index, fielder] of fielders.entries()) {
      const clone = clones[index]
      if (fielder.slot === initialChaserSlot && tick <= CHASER_SKIP_TICKS) continue
      // b1416 — +0x127 && aa0 ≥ t 면 낙구 지점으로 달린다(정지 아님 · n 안 셈). 움직임허용이 아니면 정지도 n 도 없다
      const runningToLanding = movable && options.chaseToLanding === true && trajectory.landingTick >= tick
      const standing = movable && !runningToLanding
      if (standing) clone.runTicks += 1
      const unlocked = (clone.pose & POSE.THROWN) === 0 && clone.slackTicks <= 0 && clone.lockTicks <= 0
      // b1416 vt14 = 0xa14c8 — +0xb4 ≤ 0 · vtc8(+0xb1 == 0 && +0xcc ≤ 0)일 때만 목표를 받는다(잠긴 복제는 앞 목표 그대로)
      if (runningToLanding && unlocked) clone.target = landingTarget
      // b146c — vtc8(+0xb1 == 0 && +0xcc ≤ 0) && +0xb4 ≤ 0 이 아니면 판정 없이 복제 틱만 (정지면 n 을 되돌린다)
      // 움직임허용이 아니면(a = 0 이고 공+0xaac == 0 — 보통 송구) 정지(vt10)도 낙구 달리기(vt14)도 없어 복제는 진짜 야수에게서
      // 물려받은 목표점 +0x2c 로 vt0c(0xa1284 → 0xbf158) 걸음을 그대로 걷는다 — 루로 달려가던 커버가 루에 닿아 받는다
      if (!unlocked) {
        if (standing) clone.runTicks -= 1
        tickClone(clone, fielder.speed)
        continue
      }
      // b14d0 — 정지면 vt10(0xa124c → 0xbf2b0 목표 = 위치): 판정 뒤 복제 틱은 제자리다
      if (standing) clone.target = clone.position
      // b15d8~b1642 — 다이빙 후보: 공 첫 점이 표준 배팅 지점 · h ≤ 500 · 1000 < d ≤ 2000 · 지금까지 가장 가까운 d
      {
        const distance = approachedDistanceOf({
          slot: fielder.slot,
          fielder: clone.position,
          runTicks: standing ? clone.runTicks : 0,
          speed: fielder.speed,
          ball,
          tick,
          landingTick: trajectory.landingTick,
        })
        if (
          trajectory.startedAtPlate &&
          ball.y <= HEIGHT_WINDOW.grounder &&
          distance > DIVE_DISTANCE.minimum &&
          distance <= DIVE_DISTANCE.maximum &&
          diveDistances[index]! > distance
        ) {
          diveTicks[index] = tick
          diveDistances[index] = distance
        }
      }
      if (recording) {
        const kinds = catchKindsAt({
          slot: fielder.slot,
          // 정지면 복제는 제자리(vt10)이고 "그 사이 뛴 만큼"(속도 × n)을 거리에서 뺀다 — 원본 직선 근사
          fielder: clone.position,
          runTicks: standing ? clone.runTicks : 0,
          speed: fielder.speed,
          ball,
          tick,
          landingTick: trajectory.landingTick,
          jumpUnlocked: options.jumpUnlocked,
          slideUnlocked: options.slideUnlocked,
          onlySlot: options.onlySlot,
        })
        // 야수마다 종류별 min(t) 를 적고 0xb3b38 이 칸 차례로 `<` 비교해 고른다 — 두 번째 패스가 t 를 되돌리면 더 이른 틱이 덮는다
        for (const kind of kinds) {
          const key = keyOf[kind]
          const entry = table[key]
          if (entry === null || tick < entry.tick || (tick === entry.tick && fielder.slot < entry.slot)) {
            table[key] = { tick, slot: fielder.slot }
          }
        }
      }
      // b17fc 복제.vt0c — 낙구 지점으로 달리는 중이면 한 틱 이동(정지면 vt10 이 이미 멈췄다) · 움직임허용이 아니면 물려받은 목표로
      tickClone(clone, fielder.speed)
    }
    // 끝내기 0xb185e: 한 종류라도 적히고 나면 5틱만 더 보고 끝낸다 (P2 2a "남은틱 = 5")
    if (table.low !== null || table.chest !== null || table.grounder !== null || table.jump !== null || table.slide !== null) {
      remainingTicks -= 1
      if (remainingTicks <= 0) break
    }
    // b1878 — a = 0 이고 t 가 궤적 끝(공+0x6c)이면 두 번째 패스: 모두 움직임허용 · t = 10 부터 (n · 복제 · 표는 그대로)
    if (firstPass && tick === trajectory.length) {
      firstPass = false
      movable = true
      tick = SECOND_PASS_FIRST_TICK - 1
    }
  }

  // 0xb3b38: Q = 공점(lo 틱) — lo 가 없으면 100000(0xb3b60)이라 0xa25b0 이 궤적 마지막 점으로 자른다
  const lowPoint = trajectory.pointAt(table.low?.tick ?? NO_LOW_TICK)
  const nearestSlot = nearestSlotTo(fielders, lowPoint)
  const choice = chooseChaser(table, trajectory.landingTick, nearestSlot)
  const fenceChasePoint = fenceChasePointOf(trajectory, table)
  const ticks = [table.low, table.chest, table.grounder, table.jump, table.slide]
    .filter((entry): entry is CatchOpportunity => entry !== null)
    .map((entry) => entry.tick)

  return {
    table,
    choice,
    earliestCatchTick: ticks.length === 0 ? NO_CATCH_TICK : Math.min(...ticks),
    point: trajectory.pointAt(choice.catchTick),
    fenceChasePoint,
    secondPassStarted: options.secondPass !== undefined && !firstPass,
    diveTicks,
    backupSlot: fenceChasePoint === null ? backupSlotOf(fielders, choice.slot, lowPoint) : -1,
  }
}

/**
 * 0xb3b38 의 담장 갈래(직접 뜬 것):
 * ```
 * b3e5c  r3 = min(sp38 땅볼, sp3c 가슴, sp40 낮은 공)      ; 없으면 100000(b3b60)
 * b3e6e  W = 공+0xaa4(sp44) ; W == −1 → b3ebe(백업) ; W ≥ r3 → b3ebe
 * b3e7a  0xa25b0(공, W − 2) → (x, y, z) ; b3e8c 고른 야수 AI = 0xb(0xb8dbc) ; b3e96~b3eba 목표 +0x90 = (x, 0, z)
 * ```
 * AI 0xb(분기표 0xd8808 → 0xb4b5c)는 목표 +0x90 으로 걷는다 — 공이 아니라 담장 앞으로 간다.
 */
function fenceChasePointOf(trajectory: BattedBallTrajectory, table: CatchTable): WorldPoint | null {
  const fenceTick = trajectory.fenceTick
  if (fenceTick === -1) return null
  const earliest = Math.min(
    table.grounder?.tick ?? NO_LOW_TICK,
    table.chest?.tick ?? NO_LOW_TICK,
    table.low?.tick ?? NO_LOW_TICK,
  )
  if (fenceTick >= earliest) return null
  const point = trajectory.pointAt(fenceTick - 2)
  return { x: point.x, y: 0, z: point.z }
}

/** b3ece — 백업 거리의 처음 최소 0x61a80 */
const BACKUP_DISTANCE_START = 400_000

/** b3ebe~b3f62 — 백업 야수 (`CatchForecast.backupSlot`) */
function backupSlotOf(fielders: readonly FielderState[], chaserSlot: number, lowPoint: WorldPoint): number {
  if (!isOutfieldSlot(chaserSlot)) return -1
  let best = -1
  let bestDistance = BACKUP_DISTANCE_START
  // b3ed2 칸 5 부터 8 까지 — 0xb8da8 이 외야(6~8)만 남긴다
  for (let slot = 5; slot <= 8; slot += 1) {
    const fielder = fielders[slot]
    if (fielder === undefined || !isOutfieldSlot(fielder.slot) || fielder.slot === chaserSlot) continue
    const distance = horizontalDistance(fielder.position, lowPoint)
    if (distance < bestDistance) {
      bestDistance = distance
      best = fielder.slot
    }
  }
  return best
}

/** 0xb3b60 — 표가 비었을 때의 틱 100000 */
const NO_LOW_TICK = 100_000

interface ForecastClone {
  position: WorldPoint
  runTicks: number
  lockTicks: number
  slackTicks: number
  /** 자세 워드 +0xb0 (`fielderPose.POSE`) */
  pose: number
  /** 동작 +0xa8 */
  action: number
  /** 동작 프레임 +0xac */
  frame: number
  /**
   * 복제의 목표점 +0x2c — 진짜 야수의 것을 물려받는다. vt10(0xa124c → 0xbf2b0)이 제 위치로 둔다: 정지 판정(b14d0) ·
   * 자세 워드를 지운 틱(a143e) · 동작 잠금 +0xb4 가 0 이 된 틱(a12c8)
   */
  target: WorldPoint
}

/**
 * 복제의 야수 틱 0xa1284 — 프레임 +1(a1286) · 동작 잠금이 있으면 −1 만 하고 끝(a12b4~a12d6, 0 이 되면 vt10), 아니면 +0xcc −1(a1330)
 * 뒤 이동 관문(0xa0f7c && vtc8 && +0xb4 ≤ 0, a1346~a1376)이 서면 목표로 한 틱(기반 캐릭터 이동 0xbf158 = `stepToward`), 끝에
 * 지우기 규칙(a137a~a143e — `fielderPose.shouldClearPose`: 던진 뒤 +0xb1 이면 vtc8 거짓으로 곧바로)이 서면 워드 · 동작 0 · vt10(목표 = 위치).
 * 던진 야수의 첫 복제 틱은 그래서 걸음 없이 풀린다(U-78, 에뮬 확인 — 동작 5 · +0xac 0 · +0xb1 1 로 한 번 돌리면 +0xb1 = 0 · 동작 0 ·
 * 위치 그대로). 점프 · 가슴 높이 포구 동작 중인 복제는 프레임 1 · 2 에만 걷는다.
 */
function tickClone(clone: ForecastClone, speed: number): void {
  clone.frame += 1
  if (clone.lockTicks > 0) {
    clone.lockTicks -= 1
    // a12c8~a12d2 — 잠금이 막 0 이 된 틱은 vt10(0xa124c → 0xbf2b0 목표 = 위치 · 동작 · 워드 0)을 부르고 끝(a12d6)
    if (clone.lockTicks <= 0) {
      clone.target = clone.position
      clone.pose = 0
      clone.action = 0
    }
    return
  }
  // a1330 — +0xcc 를 먼저 줄이고 a1346 의 vtc8 이 같은 틱에 본다
  if (clone.slackTicks > 0) clone.slackTicks = Math.max(0, clone.slackTicks - 1)
  // a1346 이동은 0xa0f7c · vtc8(+0xb1 · +0xcc) 뒤 · a143e 의 지우기는 이동 뒤다
  if (isFreezeOpen(clone.pose, clone.frame) && (clone.pose & POSE.THROWN) === 0 && clone.slackTicks <= 0) {
    clone.position = stepToward(clone.position, clone.target, speed)
  }
  if (shouldClearPose({ pose: clone.pose, action: clone.action, actionFrame: clone.frame, arrivalSlackTicks: clone.slackTicks })) {
    // a143e — +0xb0~+0xb3 지우기 · vt10(목표 = 위치 · 동작 0)
    clone.pose = 0
    clone.action = 0
    clone.target = clone.position
  }
}

/**
 * 낮은 공 지점에 가장 가까운 야수 (0xb3b38 이 우선순위 1·8 에서 쓰는 야수) — 0xb3c00~0xb3c6c:
 * 거리 0xbf9f0(isqrt(dx² + dz²)) < 지금 최소(처음 0x40000000) && 진짜 야수의 +0xb4 ≤ 0 && +0xbc == 0 인 야수, 없으면 0.
 * (+0xbc 는 vta0 0xa1e94 가 세우고 다음 야수 틱에 지우는 칸이라 이 웹 모델엔 없다)
 */
export function nearestSlotTo(fielders: readonly FielderState[], point: WorldPoint): number {
  let best = 0
  let bestDistance = 0x40000000
  for (const fielder of fielders) {
    const distance = horizontalDistance(fielder.position, point)
    if (distance < bestDistance && fielder.actionLockTicks <= 0) {
      bestDistance = distance
      best = fielder.slot
    }
  }
  return best
}
