import { OUT_KIND, type OutJudgement, judgeOut, releaseForcesAfterOut } from '@/entities/fielding/model/outJudgement'
import { NO_RUNDOWN, endRundown } from '@/entities/fielding/model/rundown'
import { markOut } from '@/features/defense-play/model/defensePlay/runners/mutableRunner'
import { contextAt } from '@/features/defense-play/model/defensePlay/step/defenseContext'
import type { TickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefensePlayState, MutableRunner } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { pushPlayLog } from '@/features/defense-play/model/playLog'

/**
 * **아웃 판정 0xb36d0 (플레이 vt90) 한 번 돌리기.**
 *
 * 원본이 이 판정을 부르는 자리는 하나가 아니다 — **공을 쥘 때마다**(`0xb2710` 안 `0xb2758`) 한 번,
 * 그리고 플레이 틱 `0xb401c` 안 `0xb43da`("이 플레이의 야수가 공을 쥐고 있으면")에서 **틱마다** 한 번.
 * 그래서 여기서도 세 자리에서 부른다: 야수가 공을 잡았을 때 · 송구가 루에 닿았을 때 · 틱 갱신 뒤.
 * 잡는 순간에도 한 번 도는 것이 중요하다 — 그러지 않으면 "송구가 닿는 그 틱에 루를 밟은 주자" 가
 * 늘 세이프가 되어, 예전의 송구 도착 판정과 아슬아슬한 경우의 답이 달라진다.
 *
 * 원본처럼 **타자주자(0번)도 판정한다** — 1루 포스·태그 아웃과 쥐는 순간의 뜬공 아웃(결과 1)이 모두 여기서 난다.
 * (예전 웹은 타자주자의 운명을 타석 결과 코드가 정한다며 0번을 뺐다 — 결과를 먼저 정한 웹 다리라 걷었다.)
 *
 * ## `tagOut`(원본 `state[0x87]`)은 "한 번이라도" 가 아니라 **"마지막 판정"** 이다 — 직접 뜬 근거
 * ```
 * b36d2: ldr  r3,[r0,#0x28] ; b36d8: adds r3,#0x87 ; b36dc: strb r2(=0),[r3]
 *        → 0xb36d0 은 **부를 때마다 머리에서 state[0x87] = 0** 으로 지우고 시작한다.
 * b3940: cmp r1,#3 ; b394a: ldr r3,[r5,#0x28] ; b394e: adds r3,#0x87 ; b3950: strb r2(=1),[r3]
 *        → 결과가 3(태그)일 때만 1 을 적고 곧바로 아웃 꼬리(0xb36fa)로 빠져 **그 자리에서 돌아온다**.
 * b43cc: 이 플레이의 야수(0xb0c90)가 +0xe0(공 쥠) 이면 b43da 에서 **매 틱** vt90 을 부른다.
 * ```
 * 곧 그 칸은 **직전 0xb36d0 한 번의 결과**만 담는다. 그런데 읽는 자리가 언제인지가 중요하다:
 * ```
 * b4540: ldr r1,[sp,#0x34] ; cmp #0 ; beq …   ; **이번 틱의 vt90 결과**가 0 이 아니면
 * b4546: state[0x1f] 면 플레이+0x12b = 1
 * b4556: movs r4,#0xd ; str r4,[sp,#0x38]     ; **결과 코드 13**
 * b4562: vt44(13) · vt54(13) → 화면 판정 스위치 0x51a94 의 v = 13 갈래
 * 51b3a: ldrb r3,[r2,#0x1f] ≠ 0 → 62 / 51b44: ldrb state[0x87] ≠ 0 → 62 / 아니면 20
 * ```
 * 결과 코드 13 은 **아웃이 난 바로 그 틱의 끝**에서, 같은 틱 안에서 화면 쪽으로 넘어간다.
 * 그러니 0x51b36 이 보는 `state[0x87]` 은 언제나 **그 아웃을 낸 판정의 값**이고,
 * 아웃이 안 난 틱의 지우기(0xb36d8)는 **아무도 읽지 않아 보이지 않는다**.
 *
 * → 그래서 여기서는 **아웃이 적히는 자리에서만** 갈아 끼운다(덮어쓴다). 아웃이 안 난 판정으로
 *   지우지 않는다 — 지워 봐야 원본에서 읽히지 않는 값이고, 웹은 콜을 **플레이 끝에 한 번**만
 *   내므로 지우면 오히려 "그 아웃을 낸 판정" 을 잃는다. 아웃이 여럿이면 **마지막 아웃**이 이긴다.
 *
 * **원본 `state[0x87]` 의 나머지 절반(0xb4312)** — 원본은 결과가 **2(루 아웃)** 이면서 공 가진 야수(F = 0xb0c90)의
 *    `+0x3b`(막 닿음)가 서 있을 때도 이 칸을 세운다. 2026-10 r87 에 그 갈래를 다시 떠 옮겼다(6b 절 `baseOutFold`):
 *    - `+0x3b` 는 야수 vtable `0xd7934` 의 vt30 도 주자와 같은 `0xbf0dc` 라, 갱신 머리에서 지우고(bf0e6) 목표점에
 *      **막 닿은 갱신에서만** 1 이 된다(bf146) — 한 틱짜리 맥박. 웹은 `fielderArrivals` 다. (예전에 vt18(위치 == 목표)로
 *      바꿔 끼웠다가 루에서 기다리던 커버까지 걸려 **땅볼 포스 아웃이 죄다 62 로 뒤집혔다** — 맥박이 아니라서다.)
 *    - 그 갈래 b42e0 은 포구 틱 구역이 아니라 **매 플레이 틱** 지난다 — b4072(vt50 거짓) · b41aa(포구 틱 아님) ·
 *      b4290(메시지 갈래) · 쥐기 b42c8 뒤가 모두 b42ce 로 온다(예전 메모 "포구 틱에만" 은 틀렸다).
 *      `0xa99d8`(아웃 아닌(+0x96 == 0) 주자 중 +0x3b 가 있나) || F+0x3b 면 vt90 을 b42f2 에서 부르고, 결과가 2 이고
 *      F+0x3b 면 1 을 적은 뒤, 협살 중(+0x1f0 ≠ −1)이고 그 주자+0x3b 면 협살을 끝내고(b4336) **b43ec 로 곧장** 간다 —
 *      그 틱엔 협살 시작(b433c~b4378)도 b43da 판정도 없다. 아니면 b433c → (협살 시작 b4374 → b43da) 또는 b43cc(F+0xe0) → b43da.
 *      곧 플레이 틱의 판정은 어느 갈래든 **한 번**이다.
 *    - 들고 뛰어 루에 닿은 야수의 포스 아웃처럼 **F 가 막 닿은 틱에 판정이 루 아웃을 내면** 콜이 62 가 된다. 루에서 기다리던
 *      커버가 송구를 받아 내는 포스 아웃은 쥐기 판정(0xb2758)이 내고 두 번째 판정은 아웃이 없어 0 으로 지워진다(콜 20).
 *    포구 틱에는 vt90 이 두 번 돈다 — 쥐기 안(0xb2758) 한 번, 그 뒤 같은 플레이 틱 0xb401c 의 `b42f2` 또는
 *    `b43de` 한 번(쥐기가 야수+0xe0 = 1 을 세우니 둘 중 하나는 반드시 돈다 — b42c8 → b42ce → b42e0 / b43cc, 직접 뜸).
 *    두 번째도 머리(b36dc)에서 `state[0x87] = 0` 으로 지우므로, **쥐기 판정이 아웃을 내고 두 번째가 태그(3)도 아니고
 *    b4312 갈래도 아니면 결과 코드 13 을 읽는 b4540 시점의 칸은 0** 이다(콜 20). 두 번째 판정은 웹 6b 절이고 같은 그림의
 *    슬롯 2(이동 앞)라 그 차례대로 옮겼다 — 쥐기에서 아웃이 난 틱은 6b 판정 결과로 `tagOut` 을 다시 적는다(`grabOutThisTick`).
 */
export function runOutJudgement(s: DefensePlayState, t: TickFrame): void {
  if (s.play.finished) return
  // +0x112 — 웹은 쥔 적(everHeld)과 땅·담장선에 닿음(ballContacted)을 따로 든다. 판정은 둘을 합친 원본 칸을 본다
  const judged = judgeOut({ ...contextAt(s, t.tick), play: { ...s.play, everHeld: s.play.everHeld || s.ballContacted } })
  t.judgedKindThisCall = judged.kind
  if (judged.kind === OUT_KIND.NONE) return
  const victim = s.runners[judged.runnerIndex]
  if (victim === undefined || victim.state.isOut) return
  applyOutTail(s, t, victim, judged)
}

/**
 * 아웃 꼬리 0xb36fa — state[6]++ · **+0x110 = 0**(b3708) · state[0x1c] = 0 · **state[7] = 1**(b3716) · 주자+0x96 = 1 · 0xa9648.
 * +0x110(사건 7 파울)이 내려가면 포구 관문 vt50(0xb2ac8 b2af6) · 커버 b2564 의 파울 갈래(b2592)가 다시 열린다 (r171).
 * 0xb394e — state[0x87] = (결과 == 3). 아웃이 적히는 이 자리에서만 갈아 끼운다 (`runOutJudgement` 주석)
 */
function applyOutTail(s: DefensePlayState, t: TickFrame, victim: MutableRunner, judged: OutJudgement): void {
  markOut(victim)
  s.outs += 1
  s.outsAdded += 1
  t.outJudgedThisTick = true
  s.foulFlag = false
  s.wideFair = true
  s.tagOut = judged.kind === OUT_KIND.TAG
  const rundownTag = judged.kind === OUT_KIND.TAG && s.rundown.runnerIndex === judged.runnerIndex
  if (rundownTag) s.rundownOuts += 1
  pushPlayLog(s.log, () => outLogOf(t, judged, rundownTag))
  // 결과 3(태그)이면 원본은 그 자리에서 협살을 끝낸다 (0xb3946 → 0xb26b8)
  if (judged.kind === OUT_KIND.TAG) {
    s.fielders = endRundown(s.fielders)
    s.rundown = NO_RUNDOWN
  }
  // 0xa9648 — 아웃 뒤 포스 풀기
  const relaxed = releaseForcesAfterOut(s.runners.map((runner) => runner.state))
  s.runners.forEach((runner, index) => {
    runner.state = relaxed[index] ?? runner.state
  })
}

const OUT_KIND_NAMES: Readonly<Record<number, string>> = { [OUT_KIND.FLY]: '뜬공', [OUT_KIND.BASE]: '루' }

/** 아웃 기록 줄 — 쫓던 협살 주자의 태그 아웃은 따로 적는다 */
function outLogOf(t: TickFrame, judged: OutJudgement, rundownTag: boolean): string {
  if (rundownTag) return `${t.tick}틱 협살 태그 — ${judged.runnerIndex}번 주자 아웃`
  const name = OUT_KIND_NAMES[judged.kind] ?? '태그'
  return `${t.tick}틱 ${judged.runnerIndex}번 주자 ${name} 아웃 (0xb36d0 결과 ${judged.kind})`
}
