import { requiredBasesOnFlyCatch } from '@/entities/fielding/model/autoAdvance'
import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { NONE } from '@/entities/fielding/model/fieldingState'
import { OUT_KIND, baseUnderFoot } from '@/entities/fielding/model/outJudgement'
import { readyTicksOf } from '@/entities/fielding/model/throwPlan'
import { runOutJudgement } from '@/features/defense-play/model/defensePlay/judgement/outJudgement'
import { isAtTarget } from '@/features/defense-play/model/defensePlay/runners/mutableRunner'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { pushPlayLog } from '@/features/defense-play/model/playLog'

/**
 * **포구 틱의 쥐기** — 결과 코드 9 보기(b4292) → 쥐기 0xb2710(+0x12c = 1 → vt90 아웃 판정 → +0x112 = 1) → 뜬공이면 리터치.
 *
 * 송구는 포구 틱에 고르지 않는다 — 준비 틱(+0xc8)이 다 줄어든 틱(포구 + R)에 그때 상태로 고른다.
 * 쥐기 0xb2710(P, f, 1)은 +0x128 = 1 · +0xc8 = R(내야 3 · 외야 6)을 넣을 뿐 송구 호출이 없다. 공을 내보내는 쪽은
 * 둘 다 공 가진 야수의 준비(vtC4 = 0xa20ec, +0xc8 ≤ 0)를 먼저 본다 (직접 뜬 것):
 * ```
 * b4660~b4684: +0x160 ≠ −1 && +0x12c && 공가진야수.vtC4()  → 사람 목표 (1b 절)
 * afa6c~afab8: +0x128 && 공가진야수.vtC4() && +0xe0 && AI ∉ {8,9} && +0xc8 ≤ 0 → 점수식 0xafb24 (4c 절)
 * ```
 * 야수 틱 0xa1284(0' 절)가 플레이 틱보다 먼저 +0xc8 을 줄이므로 포구 c 틱에 넣은 R 은 c + R 틱 머리에서 0 이 되고,
 * 그 틱의 1b · 4c 절이 **그때의 주자·야수 자리**로 고른다(07e80dc · 46d8420 이 옮긴 차례 그대로).
 * 타자주자도 다른 주자처럼 1루 포스(요구 루 1 — 낙구 틱의 0xa95e8)·태그로 0xb36d0 이 죽인다 — 정해 둔 아웃 틱은 없다
 */
export function grabBall(s: DefensePlayState, t: TickFrame): void {
  markRunnerStandingUnderCatch(s, t)
  holdBallInGlove(s)
  // 공 쥐기 0xb2710(b2710~b2782, 직접 뜬 것): +0x12c = 1(쥠) → b2758 vt90 = 0xb36d0 아웃 판정 → b2766 +0x112 = 1.
  // 그래서 쥐는 그 판정은 +0x112(아무도 안 쥐었고 · 땅에도 담장선에도 안 닿음)가 0 인 채로 본다 — 타자주자의
  // 뜬공 아웃(0xb3834, 결과 1)은 이 한 번에만 날 수 있다. 결과가 1 이면 b2770 이 0xa9620(리터치) · 0xa95c0 을 부르고
  // state[0x1f] = 1 이다(0xb2774). 악송구 공·튕긴 공을 줍는 쥐기에는 +0x112 가 이미 서 있어 뜬공 아웃이 없다
  s.play = { ...s.play, held: true, wantsThrow: true }
  // 쥐기 0xb2710 — +0x127 = 0
  s.landingChase = false
  pushPlayLog(s.log, () => `${t.tick}틱 ${s.chaserSlot}번 야수가 잡았다 (종류 ${s.play.catchKind})`)
  t.judgedKindThisCall = OUT_KIND.NONE
  runOutJudgement(s, t)
  t.grabOutThisTick = t.outJudgedThisTick
  const caughtFly = t.judgedKindThisCall === OUT_KIND.FLY
  s.play = { ...s.play, everHeld: true }
  if (caughtFly) retouchAfterFlyOut(s)
  // 굴러간 공의 포스 요구 루(0xa95e8)는 쥘 때가 아니라 **공이 땅에 닿은 틱**에 선다 — 6d 절 b44f8~b453c.
  // 쥐기 0xb2710 은 vt90 == 1(뜬공 아웃)일 때만 0xa9620 · 0xa95c0 을 부른다(b2770~b2782).
  s.ballContacted = true
}

/**
 * b4292 (쥐기 b42c8 **앞**, 직접 뜬 것): b = 야수.vt58()(발밑 루 — 좌표 완전일치) ; b ≠ −1 이고 R = 0xa97a0(b)(아웃 아닌 주자 중
 * 그 루에 마지막으로 닿은 첫 주자)가 있고 R.vt18()(목표점에 있음)이면 결과 코드 sp+0x38 = 9 (b42bc). 모든 포구에 걸린다 —
 * 견제 · 주자 판(pickoffPlay · runnerPlayEngine)과 같은 갈래다. 쥐기 안 vt90 이 아웃을 내면 b4540 이 13 으로 덮는다.
 * 야수 자리는 그림 N 의 목록 틱(앞 판 틱의 6 절 이동)이 옮긴 그대로다 — 쥐기 0xb2710 은 위치를 안 바꾼다(r176)
 */
function markRunnerStandingUnderCatch(s: DefensePlayState, t: TickFrame): void {
  const catcher = s.fielders[s.chaserSlot]
  const footBase = catcher === undefined ? NONE : baseUnderFoot(catcher)
  if (footBase === NONE) return
  const standing = s.runners.find((runner) => !runner.state.isOut && runner.state.startBase === footBase)
  if (standing === undefined || !isAtTarget(standing.state)) return
  t.catchResultCode = 9
  pushPlayLog(
    s.log,
    () => `${t.tick}틱 결과 코드 9 — ${s.chaserSlot}번 야수가 ${footBase}루 위에서 잡았지만 ${standing.state.index}번 주자가 서 있다 (b4292)`,
  )
}

/**
 * 쥐기 0xb2710(b2710~b2786)은 +0x128 · +0x130 · +0x12c · +0x112 · 야수+0xe0 · +0x127 만 적는다 — 위치(+0x20) · 목표(+0x2c)를
 * 안 바꾼다(r176, 예전 웹은 포구 지점으로 옮겼다). 포구 틱 갈래(b41aa)도 공 틱 == +0x174 만 보고 거리는 안 본다 —
 * 예보(0xb12d0)가 d = 거리 − 220 × n ≤ 반경으로 고른 틱이라 못 닿은 채 쥘 수 있고, 쥔 뒤에는 AI 1(b4ae6 +0xe0)이
 * 목표를 안 고쳐 다음 야수 틱들이 포구 지점으로 마저 걷다가 포구 동작이 지워지는 틱(a143e vt10 — 목표 = 위치)에 선다.
 * 잡고 던지기까지의 준비 틱(내야 3 · 외야 6, cfg+0x20/+0x22) 을 동작 남은 틱(+0xc8)에 넣는다.
 * `defenseArrivalTicks` 의 "이미 잡았다" 갈래가 이 칸을 그대로 더한다 (0xaf53e).
 */
function holdBallInGlove(s: DefensePlayState): void {
  s.fielders = s.fielders.map((fielder) =>
    fielder.slot === s.chaserSlot ? { ...fielder, holdingBall: true, actionRemainingTicks: readyTicksOf(fielder.slot) } : fielder,
  )
}

/**
 * 뜬공 아웃 — 타자주자는 0xb36d0 이 죽였다. 나머지는 리터치(0xa9620) 뒤 태그업 판정을 받는다.
 * **근사**: 리터치는 즉시 성립한 것으로 본다. 원본은 돌아가는 동안 더블아웃이 날 수 있다.
 * 포스가 풀린다 — 뜬 채로 잡히면 타자주자가 1루에 안 서므로 뒤에서 미는 힘이 사라진다.
 * 원본 0xa9620 이 **모든 주자의 요구 루를 원래 루로** 되돌리는 것과 같은 자리다.
 * (안 되돌리면 리터치한 주자가 곧바로 다시 뛰어 나가 포스 아웃을 당한다)
 */
function retouchAfterFlyOut(s: DefensePlayState): void {
  s.flyOut = true
  const required = requiredBasesOnFlyCatch(s.runners.map((runner) => runner.state))
  for (let index = 1; index < s.runners.length; index += 1) {
    const runner = s.runners[index]
    if (runner.state.isOut) continue
    const back = basePosition(runner.state.pitchBase)
    const pitchBase = runner.state.pitchBase
    runner.state = {
      ...runner.state,
      position: back,
      legStart: back,
      startBase: pitchBase,
      targetBase: pitchBase,
      requiredBase: required[index],
      settled: false,
    }
    runner.minimumBase = runner.state.pitchBase
  }
}
