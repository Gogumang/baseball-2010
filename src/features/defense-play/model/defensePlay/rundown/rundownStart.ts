import { withPoseCleared } from '@/entities/fielding/model/fielderPose'
import { AI_STATE, type DefenseContext, NONE } from '@/entities/fielding/model/fieldingState'
import { buildRundownPlan, canStartRundown, chooseRundownRunner } from '@/entities/fielding/model/rundown'
import { isForcedRunner } from '@/entities/fielding/model/throwTargetBase'
import { contextAt } from '@/features/defense-play/model/defensePlay/step/defenseContext'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { isBugFixed } from '@/shared/config/bugfixes'
import { pushPlayLog } from '@/features/defense-play/model/playLog'

/**
 * **b42ce~b42ec 갈래(직접 뜬 것, 2026-10 r87)** — F = 야수[P+0x130](0xb0c90) ;
 * `0xa99d8(주자관리)`(아웃 아닌(+0x96 == 0) 주자 중 +0x3b(막 닿음)가 하나라도 있나) || F+0x3b 이면 **b42ee 갈래**를 탄다 —
 * vt90 한 번(b42f2) → 결과 2 && F+0x3b 면 state[0x87] = 1(b4312) → 협살 중(+0x1f0 ≠ −1)이고 그 주자(0xa9564)+0x3b 면
 * 협살 종료 0xb26b8(b4336) → **b43ec 로 곧장** 간다. 곧 그 틱에는 협살 시작 b433c~b4378(0xb3fa8 · 0xb3a94)도,
 * b43cc~b43ea 의 vt90 도 없다. b42ce 는 포구 틱만이 아니라 **매 플레이 틱** 지난다(b4072 · b41aa · b4290 이 모두 b42ce 로 온다).
 * 두 +0x3b 는 그림 N 의 목록 틱(앞 판 틱의 6 절 이동)이 세운 값이다(`arrivedThisListTick` · `fielderArrivals`).
 */
export function isArrivalBranch(s: DefensePlayState): boolean {
  return s.runners.some((runner) => !runner.state.isOut && runner.arrivedThisListTick) || s.fielderArrivals[s.play.ballHolderSlot] === true
}

/**
 * **2b. 협살 (AI 상태 8)** — 원본은 플레이 틱 0xb401c 안 0xb433c~0xb4378 에서, 송구 판정 바로 뒤에 이 갈래를 본다:
 *   `P+0x1f0 == −1 이면 0xb3fa8(가능 검사) → state[0x31+수비측] == 1(CPU) 이면 0xb3a94(시작)`.
 * **사람이 수비하면 협살은 절대 안 일어난다** (S8 1-4). b42ee 갈래(`isArrivalBranch`)를 탄 틱은 협살 시작을 건너뛴다.
 *
 * 송구 도착은 따로 없다 — 송구공은 모두 세계 0xbfed0 공이고(`launchThrow`), 받는 야수 · 받는 틱은 송구 0xb2e38 의 예보 vt24(0) ·
 * 고르기 vt34 가 정하며 받는 것은 1 절 포구 틱 갈래(b42c8 쥐기 0xb2710(P, f, 1))다. 예전 "받은 야수 손으로 옮기기" 근사는
 * 원바운드(a17fc)까지 옮겨 걷었다. 아웃 판정은 0xb36d0(vt90) 하나가 쥘 때 · 틱마다 돌며 포스(2)와 태그(3)를 가른다(6b 절).
 *
 * **B-11 고침(bugfixes.json)**: 사람 수비에서도 협살을 건다 — 원본의 `state[0x31 + 수비측] == 1` 관문(0xb4358)을 걷고,
 * 포스로 밀려 가는 주자는 빼낸다(`isHumanForcedRunner`). 사람 수비면 공격은 CPU 라 주자가 되돌지 않아(자동 주루 0xaf918 은 앞으로만)
 * 공 쥔 야수가 늘 주자가 달려오는 루의 커버(`coversBack`)다 — 짝에게 던질 일이 없어 수동 송구 원칙(키 없이 공이 안 나감)과 안 부딪친다.
 * 협살 짝 송구는 보통 송구(`rollThrowBall`)라 공은 세계 공이고, 받는 것은 1 절 포구 틱 갈래(펌블 굴림 · 쥐기 0xb2710)다
 * (A-34 — 1c 절 `rollRundownAi`). 협살 중인 두 야수의 AI(0xb48b6)는 여기서 돌지 않는다 — 플레이 vt4c 야수 고리의 분기표
 * 0xd8808[8] 이라 1c 절이 칸 차례로 돌린다 (r313)
 */
export function startRundownIfAble(s: DefensePlayState, t: TickFrame, arrivalBranch: boolean): void {
  if (!canTryRundown(s, arrivalBranch)) return
  const context = contextAt(s, t.tick)
  // 원본처럼 타자주자(0번)도 협살 대상이다 — 고르기(0xb398c)가 **뒤 주자부터** 보므로 0번은 다른 주자가 없을 때만
  // 뽑힌다. (예전 웹은 타자주자의 운명을 결과 코드가 정한다며 0번을 뺐다 — 결과를 먼저 정한 웹 다리라 걷었다)
  const target = chooseRundownRunner(context.runners)
  if (target === NONE || isHumanForcedRunner(s, context, target) || !canStartRundown(context, true)) return
  s.rundown = buildRundownPlan(context, target)
  s.rundowns += 1
  // 0xb3a94 b3aec~b3b28 (직접 뜬 것, r176): 두 야수(+0x1ec · +0x1ed)마다 +0xb4(동작 잠금) ≤ 0 일 때만 b3b0c vt10
  // (0xa124c — 목표 = 위치 · 동작 · 자세 워드 0) → b3b20 0xb8dbd(+0x80, 8). 잠긴 야수는 둘 다 건너뛴다(AI 8 이 안 된다)
  s.fielders = s.fielders.map((fielder) =>
    (fielder.slot === s.rundown.backFielder || fielder.slot === s.rundown.frontFielder) && fielder.actionLockTicks <= 0
      ? { ...withPoseCleared(fielder), aiState: AI_STATE.RUNDOWN }
      : fielder,
  )
  pushPlayLog(
    s.log,
    () =>
      `${t.tick}틱 협살 시작 — ${s.rundown.runnerIndex}번 주자 ${s.rundown.backBase}↔${s.rundown.frontBase}루 ` +
      `(야수 ${s.rundown.backFielder}·${s.rundown.frontFielder})`,
  )
}

/** 협살을 걸 수 있는 틱 — CPU 수비(B-11 이면 사람도) · 판이 돌고 · 한 번은 쥐었고 · 협살 중이 아니고 · b42ee 갈래가 아니다 */
function canTryRundown(s: DefensePlayState, arrivalBranch: boolean): boolean {
  const rundownEnabled = s.defenseIsCpu || isBugFixed('B-11')
  if (!rundownEnabled || s.play.finished || !s.play.everHeld) return false
  return s.rundown.runnerIndex === NONE && !arrivalBranch
}

/**
 * B-11 고친 길의 사람 수비는 **포스로 밀려 가는 주자(0xb1b54 — 타자주자 · 앞 주자가 내 루로 오는 주자)를 협살하지 않는다**.
 * 그 주자는 루만 밟으면 잡히는데, 협살 AI 가 루로 가던 공 가진 야수를 주자 쪽으로 돌려 세워 포스 아웃을 놓친다
 * (원본 CPU 수비도 같은 길이 있지만 그쪽은 원본 그대로 둔다)
 */
function isHumanForcedRunner(s: DefensePlayState, context: DefenseContext, target: number): boolean {
  return !s.defenseIsCpu && isForcedRunner(context.play, context.runners, target)
}
