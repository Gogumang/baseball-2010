import { basePosition, ticksToReach } from '@/entities/fielding/model/fieldGeometry'
import {
  isRunnerStopped,
  NONE,
  type DefenseContext,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'
import { defenseArrivalTicks } from '@/entities/fielding/model/throwArrival'

/**
 * 자동 추가 진루 **0xaf918** (제어기 슬롯 8) 과 포스·태그업 요구 루 세우기 (0xa95e8 / 0xa9620).
 *
 * 한 줄 규칙: **"다음 루에 수비 송구(0xaf284)보다 2틱 넘게 먼저 닿으면 한 루 더 간다"** (P2 5a, 확정).
 * 사람이 주루 키를 한 번 누르면 경기+0x24 = 0 이 되어 이 자동이 꺼진다 (I 3b).
 *
 * ## 갈래 차례 — 원본 그대로 (직접 뜬 것)
 * ```
 * af934: for i = 주자수−1 .. 0:
 * af946:   주자.vt18() 거짓 && force == 0 → 건너뜀
 * af95e:   종류 = 플레이+0x118
 * af964:   플레이+0x111(끝남) ≠ 0 → 0xafa0e (**무조건 한 루**)      ; subs r2,#7  = 0x118−7
 * af970:   플레이+0x129      ≠ 0 → 0xafa0e (**무조건 한 루**)      ; adds r2,#0x18 = 0x111+0x18
 * af97a:   종류 == 7 → 주자+0x8c ≥ 주자+0x90+2 면 건너뜀, 아니면 0xafa0e
 * af98e:   vt94() && 플레이+0x112 == 0 → **함수 끝**
 * af9ac:   종류 ∈ {2,3,8} → **함수 끝**
 * af9b6:   틱 비교 + 앞길 검사 → 0xafa0e
 * afa0e:   주자.vt48(0xb6228(주자+0x78)) ; 플레이+0x128 = 1
 * ```
 * ⚠️ **예전 옮김은 `+0x111`·`+0x129` 를 거꾸로 읽어 "서 있으면 빈 목록" 으로 두었다.**
 * 디스어셈은 그 반대다 — 두 칸이 서면 **틱 비교 없이 전원 한 루 진루**다. 그대로 고쳤다.
 *
 * ⚠️ 원본이 진루와 함께 적는 `플레이+0x128 = 1`(송구 필요)은 이 함수가 돌려주는 목록에 담기지
 *    않는다 — 부르는 쪽(`runDefensePlay`)이 그 칸을 따로 다룬다. **근사**다.
 */

/**
 * 자동 진루를 아예 보지 않는 플레이 종류 (2 볼넷 밀어내기 · 3 · 8 홈런더비).
 *
 * ⚠️ 이 거르개는 원본에서 **루프 안**, 그것도 `+0x111`·`+0x129` 검사 **뒤**에 있다 (0xaf9ac).
 */
const SKIPPED_PLAY_KINDS = new Set([2, 3, 8])

/** 자동 진루가 걸리려면 수비 도착 틱이 주자 도착 틱보다 이만큼 넘게 커야 한다 (`t_def − 1 > t_run`) */
export const AUTO_ADVANCE_TICK_MARGIN = 2

/**
 * 한 루 더 갈지의 한 줄 판정 — `t_def − 1 > t_run` (0xaf918).
 * 곧 **수비 송구가 2틱 이상 늦을 때만** 뛴다. 딱 1틱 빠른 정도로는 안 뛴다.
 */
export function beatsThrow(runTicks: number, defenseTicks: number): boolean {
  return defenseTicks - 1 > runTicks
}

/**
 * 진루 자리 `0xafa0e` 가 `vt48` 에 넘기는 루 = `0xb6228(주자+0x78)`:
 * `r0 = [r0,#0x14]`(= **+0x8c 마지막으로 닿은 루**) ; `r0 <= 3` 이면 `r0 + 1` — 곧 **4 에서 멈춘다.**
 */
function nextBaseOf(runner: RunnerState): number {
  return runner.startBase <= 3 ? runner.startBase + 1 : runner.startBase
}

export interface AutoAdvanceDecision {
  readonly runnerIndex: number
  /** 새 목표 루 (지금 목표 루 + 1) */
  readonly toBase: number
}

export interface AutoAdvanceInput extends DefenseContext {
  /** 인자 force — 멈춘 주자까지 강제로 본다 */
  readonly force?: boolean
  /**
   * 0xa9924 "앞길이 비었나" — 바로 앞 루에 다른 주자가 없어야 한다.
   * 주자 목록만으로 판단할 수 있어 기본 구현을 두되, 바깥에서 갈아 끼울 수 있게 열어 둔다.
   */
  readonly isPathClear?: (runner: RunnerState, runners: readonly RunnerState[]) => boolean
}

/** 기본 앞길 검사 — 가려는 루를 목표로 삼은 다른 주자가 없으면 비었다고 본다 */
function defaultPathClear(runner: RunnerState, runners: readonly RunnerState[]): boolean {
  const next = runner.startBase + 1
  return !runners.some(
    (other) => other.index !== runner.index && !other.isOut && other.targetBase === next,
  )
}

/**
 * 이번 틱에 한 루 더 갈 주자들. 원본은 주자 목록을 **뒤(앞선 주자)부터** 본다.
 *
 * 잡힐 뜬공(`가장 이른 포구 틱 ≤ 낙구 틱`)이고 아직 안 잡혔으면 **아무도 안 뛴다** —
 * 그래서 원본에는 "희생플라이 보장" 이 없고, 태그업 뒤 이 판단을 한 번 더 거쳐야 홈에 들어온다.
 */
export function autoAdvanceDecisions(input: AutoAdvanceInput): readonly AutoAdvanceDecision[] {
  const { play, runners } = input
  const pathClear = input.isPathClear ?? defaultPathClear
  const decisions: AutoAdvanceDecision[] = []
  for (let index = runners.length - 1; index >= 0; index -= 1) {
    const runner = runners[index]
    if (runner === undefined || runner.isOut) continue
    // 0xaf950~0xaf95a — `r0 = vt18(주자) ; r0 != 0 → 계속 ; 아니면 force == 0 이면 건너뜀`.
    // 곧 **루에 붙어 멈춘 주자는 언제나 보고, 달리는 중인 주자는 force 일 때만 본다.**
    // ⚠️ 예전 줄은 이 조건이 **거꾸로**(멈춘 주자를 force 없이는 안 봄) 박혀 있었다.
    // 부르는 자리(`runDefensePlay`)가 늘 `force: true` 라 겉으로 드러나지 않던 자리다.
    if (!isRunnerStopped(runner) && input.force !== true) continue

    // ── 0xaf96e · 0xaf978 — **끝남(+0x111) 이나 +0x129 가 서 있으면 틱 비교 없이 한 루 진루** ──
    // 두 검사 모두 `bne 0xafa0e` 로 **진루 자리로 곧장 뛴다**. 그러니 이 갈래에서는
    // 종류 2·3·8 거르개도, vt94(잡힐 뜬공) 도, 0xaf284 틱 비교도, 앞길 검사(0xa9924)도 **안 본다**.
    if (play.finished || play.suppressed) {
      decisions.push({ runnerIndex: runner.index, toBase: nextBaseOf(runner) })
      continue
    }

    // 종류 7 은 틱 비교 없이 바로 진루한다 (이미 **투구 때 루**+2 에 닿았으면 건너뜀)
    // 0xaf97e: r3 = 주자+0x78 ; r2 = [r3,#0x14](= **+0x8c 마지막으로 닿은 루**)
    //          r3 = [r3,#0x18](= **+0x90 투구 때 루**)
    // 0xaf986: r3 += 2 ; cmp r2, r3 ; bge 0xafa30(건너뜀)
    // 오른쪽 항은 +0x90 이라 안 바뀌고, 왼쪽 항은 +0x8c = 이 모델의 `startBase` 다.
    if (play.kind === 7) {
      if (runner.startBase >= runner.pitchBase + 2) continue
      decisions.push({ runnerIndex: runner.index, toBase: nextBaseOf(runner) })
      continue
    }

    // ── 0xaf98e — vt94 = "뜬공이 잡힐 예정"(+0x11c ≤ 낙구 틱) 이고 아직 안 잡혔으면 아무도 안 뜀 ──
    // ── 0xaf9ac · 0xaf9b2 — 종류 2·3·8 은 아예 안 본다 ──
    // 둘 다 원본에서 **루프 밖이 아니라 이 자리**의 `b 0xafa38`(함수 끝) 이다. 두 조건 모두
    // 주자와 무관하니 결과는 같지만, 앞선 주자가 위 두 갈래로 이미 진루해 두었으면
    // 그 진루는 **남는다** — 그래서 `[]` 가 아니라 여기까지 모은 것을 돌려준다.
    if (play.earliestCatchTick <= input.landingTick && !play.everHeld) return decisions
    if (SKIPPED_PLAY_KINDS.has(play.kind)) return decisions

    // 0xaf9b6: b = ([주자+0x8c] + 1) % 4 — 틱을 재는 루도 **마지막으로 닿은 루**에서 한 칸이다
    const nextBase = (((runner.startBase + 1) % 4) + 4) % 4
    const runTicks = ticksToReach(runner.position, basePosition(nextBase), runner.speed) + 1
    const defenseTicks = defenseArrivalTicks(input, nextBase)
    if (beatsThrow(runTicks, defenseTicks) && pathClear(runner, runners)) {
      decisions.push({ runnerIndex: runner.index, toBase: nextBaseOf(runner) })
    }
  }
  return decisions
}

/**
 * 공이 땅에 닿거나 담장선을 넘을 때 (0xa95e8) — **포스**.
 *
 * 원본 그대로 (직접 뜬 것):
 * ```
 * a95ec: 개수 = [목록+0xc]
 * a95f6: for i = 0 .. 개수−1:
 * a95fa:   주자 = 0xa9564(목록, i)           ; **배열 첨자로** 꺼낸다
 * a9600:   r3 = [주자+0x8c]                   ; 목표 루
 * a9602:   cmp r3, i ; bgt 0xa960c → r3 = −1  ; 목표 루 > i  면 요구 없음
 * a9606:   else       r3 = [주자+0x90] + 1    ; 투구 때 루 + 1
 * a9612:   [주자+0x88] = r3                   ; 요구 루
 * ```
 * 죽은 주자도 거르지 않고 전원에게 쓴다.
 *
 * ## `i` 는 "투구 때 루" 가 아니라 **목록 번호**다 — 목록을 채우는 자리를 떠서 확정했다
 * - `0xa93ac`(주자 추가)는 **맨 앞에 끼워 넣는다**: `0xa9374` 가 `[3]←[2] [2]←[1] [1]←[0]` 으로
 *   한 칸씩 민 뒤 `[0]` 에 새 주자를 쓴다. 새 주자는 `vt88(0)`(0xa0820, 루 0 = 홈)으로 서고
 *   `+0x88 = 1`(요구 루 1루) · `+0x90 = 0` · `+0x98 = 1`(타자주자)이 붙는다.
 * - `0xa9a10`(투구 전 루 상황 세우기)은 `for r7 = 3, 2, 1: if 루표[r7] then 추가 → vt88(r7)` 이다.
 *   **빈 루는 건너뛴다.** 3루부터 넣고 매번 앞에 끼우니 결과는 `[1루, 2루, 3루]` 오름차순이 된다.
 * - 타자가 치면 `0xa93ac` 이 한 번 더 앞에 끼워 `[타자주자, …, 앞선 주자]` 가 된다.
 * - 죽은 주자는 지우지 않고 `+0x96 = 1`(0xa9520) 만 세우므로 **번호는 플레이 내내 안 바뀐다.**
 *
 * 곧 목록은 **타자주자(0)부터 빈 루를 건너뛴 오름차순** — `createPlayRunners` 가 쌓는 것과 똑같다.
 * 그러니 여기 `index` 는 원본 `i` 와 한 톨도 다르지 않다. 2루 주자만 있으면 원본도 `i = 1` 이다.
 *
 * (루 번호는 0 홈 · 1 · 2 · 3 · 4 홈 — `vt88` 이 읽는 좌표표 `0xd77d8` 의 [0]·[4] 가 같은 점이다.
 *  첨자를 쓰는 이웃들도 모두 목록 번호다: `0xa97fc`(앞 번호의 산 주자) · `0xa97d4`(뒤 번호) ·
 *  `0xa9ad4`(포인터 → 번호). 루로 찾는 것은 `0xa97a0` 하나뿐이고 그건 `+0x8c` 로 찾는다.)
 *
 * ## ✅ 왼쪽 항은 **마지막으로 닿은 루(+0x8c)** 다 — 2026-09 확정
 * 예전에는 `+0x8c` 를 "목표 루" 로 읽어 이 함수가 **늘 `NONE` 만 돌려주었다.** 원본 네 자리가
 * 한목소리로 반대를 가리킨다 (전부 직접 뜬 것):
 * ```
 * a04e8 vt90(구간 진행률):  r7 = [주자+0x7c] ; r0 = [주자+0x8c]
 *                           d1 = |루[+0x8c] − 루[+0x7c]| ; d2 = |루[+0x7c] − 지금 위치|
 *                           돌려주는 값 = 100 − 100·d2/d1        ← **+0x8c 에서 +0x7c 로 간다**
 * 9ff40 달리는 방향 그림:   r5 = [+0x7c] ; r4 = [+0x8c]
 *                           r5==0 && r4==3 → r5 = 4 ;  r5==3 && r4==0 → r4 = 4   (홈 = 0 = 4)
 *                           (r4,r5) 가 (0,1)·(1,2)·(2,3)·(3,4) 면 앞으로 가는 그림
 * a07b0 vt48(주자, b):      +0x80 = b ; d = b − [+0x8c] ; |d|>1 이면 [+0x8c] 에서 한 칸(mod 4)
 *                           +0x84 = 옛 +0x7c ; +0x7c = 그 한 칸 ; 0xa0a18 이 **루[+0x7c] 좌표**로 이동
 * aa12a 득점:               주자+0x3b(도착) && [+0x8c] == 4 이면 홈을 밟은 것
 * ```
 * 그래서 "루 b 의 주자"(`0xa97a0`)도 `+0x8c == b` 로 찾고, `0xa0820`(vt88, 루에 세우기)은
 * `+0x7c = +0x80 = +0x84 = +0x88 = +0x8c = +0x90 = b` 로 한꺼번에 적는다.
 *
 * 그러면 `[+0x8c] ≤ i` 는 "1루부터 내 앞까지 빈 루 없이 차 있다"(= 포스)가 되어
 * **타자주자부터 사슬 전원이 요구 루를 받는다.** 목록 번호가 압축 목록 번호이기 때문이다:
 * 1루가 비어 있으면 2루 주자의 닿은 루 2 가 번호 1 보다 커서 저절로 빠진다.
 *
 * ## 같이 고쳐야 넘어진다 — 앞 사람이 되돌린 이유
 * 이 항만 `startBase` 로 바꾸면 **평범한 단타에서 1루 주자가 2루에서 죽는다.** 왼쪽 항이 틀려서가
 * 아니라 **이 모델이 요구 루(+0x88)를 한 번도 안 풀어 주기 때문**이었다. 원본은 세 자리에서 푼다:
 * `0xa040c`(도착: `+0x94 && +0x8c == +0x88` → `+0x88 = −1, +0x94 = 0`) · `0xaa0a8`(틱마다) ·
 * `0xa9648`(아웃 뒤). 그래서 이번에는 넷을 함께 옮겼다:
 * 1. 여기 `+0x8c → startBase`
 * 2. `outJudgement.isStillForced`(vt10 = 0xa9f60) 의 `+0x8c → startBase`
 * 3. `outJudgement.releaseForcesAfterOut`(0xa9648) 의 `+0x8c → startBase`
 * 4. `runDefensePlay` 도착 자리에 `0xa040c` 의 `+0x8c = +0x7c` 와 요구 루 풀기
 *
 * 넷을 같이 넣고 **타구 6종 × 루 8상황 × 아웃 3 × 주루 3 × 송구 3 × 난수 2 = 3456 칸**을 전수로
 * 재니 **아웃·득점·루 상황이 한 칸도 안 바뀌었고 난수 굴림 수도 11016 로 똑같다.** 바뀐 것은
 * 판정 **종류**뿐이다: 만루 땅볼에서 3루 주자가 태그(3)가 아니라 **포스(2)** 로 죽고(27칸,
 * 아웃·득점·루는 그대로), 깊은 뜬공 태그업에서 리터치를 마친 주자를 제 루에서 다시 잡지
 * 못하게 되었다(12칸 — 위 4번이 고친 자리다).
 */
export function requiredBasesOnBounce(runners: readonly RunnerState[]): readonly number[] {
  return runners.map((runner, index) => (runner.startBase <= index ? runner.pitchBase + 1 : NONE))
}

/**
 * 뜬공 아웃이거나 경기가 끝났을 때 (0xa9620) — **태그업/리터치**.
 * 모든 주자의 요구 루 = 투구 때 있던 루(원래 루)로 돌아간다.
 */
export function requiredBasesOnFlyCatch(runners: readonly RunnerState[]): readonly number[] {
  return runners.map((runner) => runner.pitchBase)
}

/**
 * 요구 루가 풀리는 조건 (0xaa0a8): 판정끝(+0x94) 인 주자가 요구 루를 밟으면 `+0x94 = 0, +0x88 = −1`.
 * 리터치 전에 떠난 주자가 먼저 뛰는 것 자체는 막지 않는다 — 막는 것은 자동 주루의 "잡힐 뜬공" 가지뿐이다.
 *
 * **근사**: 원본 비교부 0xaa0fe~0xaa11e 는 출발·목표·요구 루 셋을 함께 보는데 그 조합까지는 안 읽었다.
 * 여기서는 "출발 루나 목표 루 중 하나가 요구 루와 같으면 밟은 것" 으로 둔다.
 */
export function clearsRequirement(runner: RunnerState): boolean {
  if (!runner.settled || runner.requiredBase === NONE) return false
  return runner.startBase === runner.requiredBase || runner.targetBase === runner.requiredBase
}

/**
 * 태그 아웃 거리 ≤ 499 (0xb36d0, I 3c). 포스·리터치는 요구 루(+0x88)와 타자주자 표시(+0x98)로 따로 본다.
 */
export const TAG_DISTANCE = 499
