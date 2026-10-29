import { type BattedBallTrajectory, type CatchOpportunity, type CatchTable, chooseChaser } from '@/entities/fielding/model/catchPrediction'
import type { FielderState } from '@/entities/fielding/model/fieldingState'
import { backupSlotOf, fenceChasePointOf, nearestSlotTo } from '@/features/defense-play/model/catchForecast/chaseChoice'
import { type ForecastRun, forecastFielderTick, lastForecastTickOf, openForecastRun } from '@/features/defense-play/model/catchForecast/forecastRun'
import { type CatchForecast, type CatchForecastOptions, NO_LOW_TICK } from '@/features/defense-play/model/catchForecast/forecastTypes'

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
 * 7 · 12 뒤라(r190) 그 판에서는 예보가 다시 돌지 않고, 다음 판이 vt20(0)(폭투 · 견제 · 도루)이면 남은 값(파울 5 · 폴 홈런 4~5)이
 * 복제에 실린다 — 웹도 판 사이로 넘긴다(`DefenseScene.fielderSlack`, r196 — 폭투 판의 포수가 늦게 쥔다))

/** b18b6 — 두 번째 패스는 t = 10 부터 */
const SECOND_PASS_FIRST_TICK = 10
/** 원본 틱 루프는 1 부터 돈다 (t = 1 → tmax) */
const FIRST_FORECAST_TICK = 1
/** 아무도 못 잡을 때 원본이 쓰는 큰 값 (플레이 +0x11c 초기값) */
const NO_CATCH_TICK = 0xffff

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
  const run = openForecastRun(trajectory, fielders, window, options)
  const last = lastForecastTickOf(run)
  // 틱 고리 — 두 번째 패스(b1878)가 고리 칸 t 를 10 으로 되돌린다. 고리 모양이 원본 차례라 그대로 둔다
  for (let tick = FIRST_FORECAST_TICK; tick <= last; tick += 1) {
    const ball = trajectory.pointAt(tick)
    for (const [index, fielder] of fielders.entries()) forecastFielderTick(run, { index, fielder, tick, ball })
    if (countDownAfterFirstCatch(run)) break
    if (run.firstPass && tick === trajectory.length) {
      startSecondPass(run)
      tick = SECOND_PASS_FIRST_TICK - 1
    }
  }
  return forecastResultOf(run, fielders)
}

/** 끝내기 0xb185e: 한 종류라도 적히고 나면 5틱만 더 보고 끝낸다 (P2 2a "남은틱 = 5"). 끝낼 틱이면 참 */
function countDownAfterFirstCatch(run: ForecastRun): boolean {
  const table = run.table
  if (table.low === null && table.chest === null && table.grounder === null && table.jump === null && table.slide === null) return false
  run.remainingTicks -= 1
  return run.remainingTicks <= 0
}

/** b1878 — a = 0 이고 t 가 궤적 끝(공+0x6c)이면 두 번째 패스: 모두 움직임허용 · t = 10 부터 (n · 복제 · 표는 그대로) */
function startSecondPass(run: ForecastRun): void {
  run.firstPass = false
  run.movable = true
}

/** 0xb3b38: Q = 공점(lo 틱) — lo 가 없으면 100000(0xb3b60)이라 0xa25b0 이 궤적 마지막 점으로 자른다 */
function forecastResultOf(run: ForecastRun, fielders: readonly FielderState[]): CatchForecast {
  const { trajectory, table } = run
  const lowPoint = trajectory.pointAt(table.low?.tick ?? NO_LOW_TICK)
  const choice = chooseChaser(table, trajectory.landingTick, nearestSlotTo(fielders, lowPoint))
  const fenceChasePoint = fenceChasePointOf(trajectory, table)
  return {
    table,
    choice,
    earliestCatchTick: earliestCatchTickOf(table),
    point: trajectory.pointAt(choice.catchTick),
    fenceChasePoint,
    secondPassStarted: run.options.secondPass !== undefined && !run.firstPass,
    movable: run.movable,
    diveTicks: run.diveTicks,
    backupSlot: fenceChasePoint === null ? backupSlotOf(fielders, choice.slot, lowPoint) : -1,
  }
}

function earliestCatchTickOf(table: CatchTable): number {
  const ticks = [table.low, table.chest, table.grounder, table.jump, table.slide]
    .filter((entry): entry is CatchOpportunity => entry !== null)
    .map((entry) => entry.tick)
  return ticks.length === 0 ? NO_CATCH_TICK : Math.min(...ticks)
}
