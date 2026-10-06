import {
  basePosition,
  BASE_DEFAULT_FIELDER,
  horizontalDistance,
  isOutfieldSlot,
  ticksToReach,
} from '@/entities/fielding/model/fieldGeometry'
import {
  fielderArrivalTicks,
  isRunnerStopped,
  NONE,
  type DefenseContext,
  type FielderState,
} from '@/entities/fielding/model/fieldingState'
import {
  RELAY_DISTANCE,
  readyTicksOf,
  relayTicksToBase,
  throwTicksTo,
  throwTicksToFielder,
} from '@/entities/fielding/model/throwPlan'

/**
 * 0xaf284(제어기, 루 b) = **수비가 공을 루 b 에 보내는 데 드는 틱**.
 * 자동 주루(0xaf918)와 CPU 송구 목표 점수식(0xafb24)이 둘 다 이 값을 기준으로 판단한다.
 *
 * 두 갈래로 갈리는 기준은 **커버 야수 유무**다 (S7 5절, 확정 — P2 가 "세부 분기 유력" 으로 남겼던 곳).
 */
export function defenseArrivalTicks(context: DefenseContext, base: number): number {
  const { play, fielders } = context
  const holder = fielders[play.ballHolderSlot]
  const catcher = fielders[play.catchFielderSlot] ?? holder
  const basePoint = basePosition(base)
  const coverSlot = play.coverOfBase[((base % 4) + 4) % 4] ?? NONE
  const cover = coverSlot === NONE ? undefined : fielders[coverSlot]

  // ── (A) 커버가 없다: 직접 뛰는 것과 루 담당 기본 야수가 닿는 것 중 빠른 쪽 ──
  if (cover === undefined) {
    const carryTicks = ticksToReach(holder.position, basePoint, holder.speed)
    const defaultFielder = fielders[BASE_DEFAULT_FIELDER[((base % 4) + 4) % 4]]
    let defaultTicks = fielderArrivalTicks(defaultFielder)
    if (defaultFielder.targetBase !== base) {
      defaultTicks += ticksToReach(defaultFielder.position, basePoint, defaultFielder.speed)
    }
    return Math.min(carryTicks, defaultTicks)
  }

  // ── (B) 커버가 있다 ──
  const relayed =
    holder.slot === catcher.slot &&
    isOutfieldSlot(holder.slot) &&
    horizontalDistance(holder.position, basePoint) >= RELAY_DISTANCE

  // 원본은 중계가 아니면 두 갈래가 완전히 같은 코드다(0xaf532 / 0xaf53e) — "언제나 잡을야수.vtb4(커버야수)"
  let ticks = relayed
    ? relayTicksToBase(fielders, holder, cover, base)
    : throwTicksToFielder(catcher, cover)

  let remaining = 0
  if (!catcher.holdingBall) {
    // 아직 공을 안 잡았다 → 잡기까지 남은 틱 + 잡고 던지기까지의 준비 틱(내야 3 / 외야 6)
    remaining = play.catchTick - context.currentTick
    ticks += readyTicksOf(catcher.slot)
  } else {
    ticks += catcher.actionRemainingTicks
  }

  // 커버 야수가 루에 못 가 있으면 그만큼 늦어진다
  ticks = Math.max(ticks, ticksToReach(cover.position, basePoint, cover.speed) - remaining)
  return remaining + ticks
}

/**
 * AI 상태 9 = **송구 타이밍 게이트** (0xb4838, S8 2절).
 * 받을 야수가 루에 닿는 시각 `t1` 이 송구 도착 시각 `t2` 보다 늦으면 이번 틱에는 던지지 않는다.
 *
 * `t1 = 받을야수.vtc0()` (목표점까지 남은 틱 + +0xcc) · `t2 = 공가진야수.vtb8(루 좌표)`
 */
export function shouldReleaseThrow(receiver: FielderState, holder: FielderState, base: number): boolean {
  const t1 = fielderArrivalTicks(receiver)
  const t2 = throwTicksTo(holder, basePosition(base))
  return t1 <= t2
}

/**
 * 사람이 방향키를 안 눌렀을 때의 자동 송구 목표 0xb1c90 (I-controls 2b).
 * **앞선 주자부터(인덱스 큰 쪽) 거꾸로** 보며 `주자 도착 틱 ≥ 송구 시간` 인 첫 루를 고른다.
 * CPU 수비는 이 함수 대신 점수식 0xafb24 를 쓴다 (플레이+0x160 이 늘 −1 이라 사람 쪽 전용).
 * ```
 * b1f86: R+0x96(아웃) → 건너뜀
 * b1fa8: R.vt18() (= 위치 == 목표점, 이미 도착) → 건너뜀
 * b1fc6: 주자 틱 = 0xbefec(R) ; 송구 = 공가진야수.vtC0() + 공가진야수.vtB8(0xd86b0[R.vt68()])
 * b2022: 주자 틱 ≥ 송구 → 그 루
 * b2036: 아무도 못 잡으면 sp+0x44 에 **마지막으로 본 산 주자의 vt68** 이 남은 채 0xb203a(커버 배치)로 간다
 * ```
 * 도착 검사보다 루 적기(b1fa2)가 먼저라, 루에 붙어 선 주자는 "잡을 대상" 에선 빠져도 그 루가 남을 수 있다.
 *
 * 송구 시간 두 항은 **둘 다 공 가진 야수의 것**이다 (직접 뜬 것):
 * ```
 * b1fce: r0 = 0xb0c90(P) ; r5 = r0.vtC0()                ; 공 가진 야수(P+0x130)의 남은 틱
 * b1fe0: r6 = 0xb0c90(P)                                  ; 다시 공 가진 야수
 * b1ff2: 루 = R.vt68() ; 점 = 0xd86b0[루]
 * b200c: r0 = r6.vtB8(점) ; r5 += r0                      ; 공 가진 야수 → 루 좌표 송구 틱
 * b2022: 주자 틱(0xbefec) ≥ r5 → 그 루
 * ```
 * 고리(b1f7a~b2038) 안에는 커버(P+0xf0) 를 읽는 명령이 없다 — 커버가 없는 루도 고른다.
 * (예전 웹은 둘째 항을 커버 야수 자리에서 루까지로 쟀고 커버 없는 루를 건너뛰었다.)
 *
 * ⚠️ **이 고리가 고른 루로 공이 나가는 자리를 원본에서 못 찾았다.** `0xb1c90` 의 고른 루(sp+0x44)는
 * 0xb203a 뒤에서 **2루 커버/중계 야수(sp+0x58, 2루수 3 · 유격수 5)의 자리 잡기**에만 쓰인다:
 * 공 가진 야수의 목표점 ~ 그 루 거리(b20ca)가 cfg+0x42(17000) 이상이고 외야수(6~8)가 아직 안 쥐었으면
 * 둘의 가운데(b2144~b21b0) 근처, 아니면 표 0xd8764 자리로 보내고 AI 상태 0xa(b2358 · b238c, 0xb8dbc)를 준다.
 * 이 함수 안에 송구(플레이.vt58 = 0xb2c90 · vt5c = 0xb2e38) 호출은 없다. 사람이 고른 루(+0x160)를 실제로
 * 던지는 곳은 플레이 틱 vt4c(0xb45dc) 안 `b4660~b46a8`(+0x160 ≠ −1 && 공 가진 야수.vtC4() → 플레이.vt58(+0x160, 0)
 * → +0x160 = −1)이고, 그 밖의 송구는 CPU 송구 결정 0xafa60(→ 0xafae6 플레이.vt58) — 사람 수동 설정에서도
 * 메시지 처리기 0x509a0 머리에서는 메시지마다 돈다(S8 4-3). 웹은 아직 "키 없는 사람 수비 = 이 루로 던진다"
 * 로 두었다(진행기 쪽 근사, 미해결).
 */
export function autoThrowTargetBase(context: DefenseContext): number {
  const { play, fielders, runners } = context
  if (play.manualThrowBase !== NONE) return play.manualThrowBase
  const holder = fielders[play.ballHolderSlot]
  // b1f6c: 고리 앞에서 맨 끝 주자의 목표 루(vt68)를 먼저 적어 둔다 — 주자가 없으면 −1(+0x160) 그대로
  let base = runners.length > 0 ? runners[runners.length - 1].targetBase : NONE
  for (let index = runners.length - 1; index >= 0; index -= 1) {
    const runner = runners[index]
    if (runner.isOut) continue
    // b1fa2: 도착 검사(b1fa8)보다 **먼저** 적는다 — 건너뛴 주자의 루도 남는다
    base = runner.targetBase
    if (isRunnerStopped(runner)) continue
    const point = basePosition(base)
    const runnerTicks = ticksToReach(runner.position, point, runner.speed)
    // b1fce~b2020: 공 가진 야수.vtC0() + 공 가진 야수.vtB8(루 좌표) — 커버 검사 없음
    const throwTicks = fielderArrivalTicks(holder) + throwTicksTo(holder, point)
    if (runnerTicks >= throwTicks) return base
  }
  // b2036 → b203a: 아무도 못 잡으면 마지막으로 본 산 주자의 루가 남은 채 커버 배치로 간다
  return base
}

/**
 * 2루 커버 규칙 (0xb1e24): 공이 1루 쪽으로 간 타구면 유격수(5), 아니면 2루수(3).
 * 잡은 야수가 그 둘 중 하나면 다른 쪽이 커버한다.
 */
export function secondBaseCoverSlot(ballHeadingToFirstSide: boolean, catchFielderSlot: number): number {
  const preferred = ballHeadingToFirstSide ? 5 : 3
  if (catchFielderSlot !== preferred) return preferred
  return preferred === 5 ? 3 : 5
}
