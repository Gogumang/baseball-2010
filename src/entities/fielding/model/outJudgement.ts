import { TAG_DISTANCE } from '@/entities/fielding/model/autoAdvance'
import { basePosition, horizontalDistance, isSamePoint } from '@/entities/fielding/model/fieldGeometry'
import {
  isRunnerStopped,
  NONE,
  type DefenseContext,
  type FielderState,
  type RunnerState,
} from '@/entities/fielding/model/fieldingState'

/**
 * **아웃 판정 0xb36d0** (플레이 vtable `0xd8618` 의 `vt90`).
 *
 * 원본은 이 함수 하나로 아웃의 **종류**까지 함께 돌려준다 — 0 아웃 아님 · 1 뜬공 · 2 루(포스) · 3 태그.
 * 그래서 "송구가 닿았다 = 아웃" 같은 한 갈래로는 옮길 수 없다: **포스가 걸리지 않은 주자는
 * 루에 공이 먼저 닿아도 안 죽고, 태그(거리 ≤ 499)를 받아야 죽는다.** 협살이 아웃으로 끝나는
 * 길도 이 3번 갈래뿐이다.
 *
 * 부르는 곳(직접 뜸): 공 쥐기 `0xb2710`(0xb2758) · 플레이 틱 `0xb401c` 안 `0xb42f2`·`0xb43de` ·
 * `0xb2c1a` · `0xb3eb4` · `0xb416e` · `0xb4b62`. 그중 `0xb43da` 는
 * **"이 플레이의 야수(`0xb0c90` = 야수[P+0x130])가 공을 쥐고 있으면"** 매 틱 부른다 — 곧
 * 공을 쥔 야수가 있는 동안 아웃 판정은 **틱마다** 돈다 (확정).
 *
 * ## 원본 뼈대 (직접 뜬 것, 주소는 분기가 값을 적는 자리)
 * ```
 * state[0x87] = 0 ; r = 0
 * 플레이 종류(+0x118) 가 {0,2,3,7,8,10} 이면 곧바로 0             ; 비트표 0x58d
 * (경기상태+0xb == 0xb 이고 주자0 이 +0x98 이면 그 주자를 아웃 표시하고 아웃 +1)
 * for i = 주자수−1 .. 0:                                        ; **앞선 주자부터**
 *   주자 = 주자표[i] ; 야수 = 야수[P+0x130]
 *   주자+0x96(아웃) 이면 건너뜀
 *   s = 주자+0x7c % 4 (**지금 달려가는 루**) · q = 주자+0x88 % 4 (요구 루) · g = 주자+0x8c % 4
 *   P+0x153 이 −1 도 s 도 g 도 아니면 건너뜀                      ; 대상 루 거르개
 *   d = 0xbece8(야수, 주자)                                     ; 평면 거리
 *   ── 3a 0xb380e: 야수 있음 && P+0x12c(쥠) && 안 죽음 && d ≤ 499 && 주자.vt18() 거짓 → r = 3
 *   ── 1  0xb3834: 주자+0x98(타자주자) && P+0x112 == 0(아직 안 잡힘) && P+0x12c → r = 1
 *   ── 2a 0xb3890: 야수 있음 && P+0x12c && 야수.vt18() && 야수.vt58() == s
 *                  && 주자+0x7c != 0 && 주자관리.vt10(i)(아직 밀려 있음) && 주자.vt18() 거짓 → r = 2
 *                  ← **이것이 평범한 포스(루) 아웃이다** (공 쥔 야수가 주자가 달려가는 루를 밟고 있다)
 *   ── 2b 0xb38e4: q != −1 && 주자+0x94(판정끝) && 주자.vt18() 거짓 && P+0x12c
 *                  && 야수 있음 && 야수.vt18() && 야수.vt58() == q → r = 2
 *   ── 3b 0xb3938: P+0x112 && 야수 있음 && P+0x12c && 야수.vt18() && 주자+0x3b(도착)
 *                  && 야수.vt58() == s && 주자+0x8c != s → r = 3
 *   r == 3 이면 협살 종료 0xb26b8 · state[0x87] = 1
 *   r != 0 이면 그 주자를 아웃으로 적고(아웃 +1, 주자+0x96 = 1) 0xa9648 을 부른 뒤 r 을 돌려준다
 * 돌려주는 값 = r
 * ```
 *
 * 갈래가 **덮어쓰기 순서**라 같은 주자에 둘 이상 서면 **뒤쪽이 이긴다** — 그 순서 그대로 옮겼다.
 *
 * ## 뜻이 밝혀진 칸들
 * - `야수.vt18()` / `주자.vt18()` = `0xbf3a0` = **현재 위치 == 목표점** (움직임이 끝났나).
 * - `야수.vt58()` = `0xa0ae4` = 루 4칸을 돌며 좌표가 **비트까지 같은** 루 번호, 없으면 −1 = **발밑 루**.
 * - `주자관리.vt10()` = `0xa9f60` = **"이 주자가 아직 밀려 있나"**(포스). 주자관리의 vtable 은
 *   생성자 `0xa92fc`/`0xa9330` 이 박는 **`0xd8308`** 이고(그래서 `vt18` 이 목록 틱 `0xaa0a8` 다),
 *   `vt10` 은 `0xa9f60` = `0..i 중 살아 있는 주자 수 > 주자 i 의 **마지막으로 닿은 루**(+0x8c)` 다
 *   (`a9f88: ldr r3,[r2,#0x14]` — r2 = 주자+0x78 이니 +0x8c).
 *   곧 "제 뒤로 주자가 **딛고 있는 루**보다 많이 살아 있다" = **아직 그 루에서 밀려나지 못했다**.
 *   예: 1루 주자는 2루로 뛰는 **동안에도** (산 주자 2 > 닿은 루 1) 참 — **2루를 밟아야** 풀린다.
 *   ⚠️ 예전 주석은 이 항을 "목표 루" 로 읽어 뛰기 시작하자마자 포스가 풀리게 해 두었다.
 * - **`+0x7c` 은 "출발 루" 가 아니라 "지금 달려가는 루"** 다 — `0xa0808` 이 `진루(주자, ±n)` 에서
 *   `+0x84 = 옛 +0x7c` 로 **직전 루를 옮겨 둔 뒤** `+0x7c = 새 루` 를 적고, 이어 `0xa0a18` 이
 *   그 루의 좌표(`0xd78f0`)를 **이동 목표(+0x2c)** 로 세운다 (확정). 그래서 `야수.vt58() == +0x7c`
 *   는 "공 쥔 야수가 **주자가 달려가는 루**를 밟고 있다" 는 뜻이고, 2a 가 평범한 포스 아웃이 된다.
 *   이 모델의 `targetBase` 가 바로 이 칸이고, **`startBase` 가 `+0x8c`**(마지막으로 닿은 루)다.
 *   `+0x84`(직전 목표)는 이 모델에 따로 없다 — 앞으로만 가는 동안 `+0x84 == +0x8c` 라 겹친다.
 *   `+0x8c` 가 "닿은 루" 라는 것은 `0xa04e8`(구간 진행률: 루[+0x8c]→루[+0x7c] 사이 몇 %) ·
 *   `0x9ff40`(달리는 방향 그림이 (+0x8c,+0x7c) 짝을 0→1·1→2·2→3·3→4 로 읽는다) ·
 *   `0xaa12a`(`+0x8c == 4` 면 홈을 밟은 것) · `0xa97a0`("루 b 의 주자" 를 `+0x8c == b` 로 찾는다)
 *   네 자리가 함께 못 박는다 (2026-09 확정).
 * - **`+0x3b` 은 야수 칸이 아니라 선수 공통 "목표점 도착" 표시**다. `0xaa12a` 가
 *   `주자+0x3b && 주자+0x8c == 4` 를 득점으로 세고, `0xaa008` 이 도착 때 `+0xb8`(슬라이딩)을 지운다.
 *   `0xb36d0` 의 3b 갈래가 보는 것도 **야수가 아니라 주자**(`r7`)의 `+0x3b` 다.
 *
 * ## 이 옮김의 근사
 * - **`P+0x153` 대상 루 거르개**는 이 모델에 칸이 없어 늘 −1(모든 주자)로 둔다 — **근사**.
 * - **3b(`0xb3938`)는 아직 안 옮겼다.** 조건은 `P+0x112 && 야수 있음 && P+0x12c && 야수.vt18()
 *   && 주자+0x3b(이번 틱에 목표점에 막 닿음) && 야수.vt58() == +0x7c%4 && +0x8c != +0x7c%4` 다.
 *   마지막 두 항이 함께 서려면 `+0x7c` 가 **4(홈)** 이어야 한다 — `+0x7c%4 = 0` 인데 도착으로
 *   `+0x8c = 4` 가 되었으니 `4 != 0` 이다. 곧 3b 는 **홈을 밟는 순간 홈을 밟고 선 야수가 잡는**
 *   갈래로 읽힌다(유력). 이 모델은 홈 도착을 득점으로 바로 처리해 그 한 틱이 없어 뺐다.
 * - **`+0x3b`(막 도착함)** 은 원본에서 선수 공통 갱신 `0xbf0dc` 가 **상승 모서리**로 세운다:
 *   `옛 도착 = [+0x3a] ; 이동 ; [+0x3a] = vt18() ; vt18() && !옛 도착 → +0x3b = 1, vt38()(도착 처리)`.
 * - **`주자+0x94`(판정끝)** 은 이 모델의 `settled`("목표점에 닿았다")와 뜻이 달라 쓰지 않는다.
 *   원본은 `+0x88`(요구 루)을 `0xa95e8`(바운드)/`0xa9620`(태그업)이 세우고 `+0x94 = 1` 은
 *   **바로 옆 `0xa95c0`**(전원에게 1)이 세운다 — 리터럴 풀이 나란하다
 *   (`0xb45cc`·`0xb45d0`·`0xb45d4` · `0xb27dc`·`0xb27e0`). 푸는 것도 `0xa040c`(도착) ·
 *   `0xaa0a8`(틱마다) · `0xa9648`(아웃 뒤)이 `+0x88 = −1` 과 **함께** 한다. 그래서 요구 루
 *   하나로 본다 (**유력**).
 * - **요구 루 풀기는 `runDefensePlay` 의 도착 자리에 있다** — `0xa040c` 가 `+0x8c = +0x7c` 를
 *   적은 뒤 `+0x94 && +0x8c == +0x88` 이면 `+0x88 = −1` 로 푼다. 이것을 안 넣으면 포스가
 *   영영 안 풀려 **단타에서 1루 주자가 2루를 지나고도 2루에서 포스 아웃난다.**
 * - 경기상태 `+0xb == 0xb` 머리 갈래(주자0 선처리)는 플레이 종류 쪽 문맥이라 옮기지 않았다.
 */

/** 아웃 종류 — 0xb36d0 이 돌려주는 0/1/2/3 그대로 */
export const OUT_KIND = {
  /** 아웃 아님 */
  NONE: 0,
  /** 1 — 뜬공 노바운드 포구 아웃 (0xb3834) */
  FLY: 1,
  /** 2 — 루(포스) 아웃 (0xb3890 · 0xb38e4) */
  BASE: 2,
  /** 3 — 태그 아웃 (0xb380e). 협살이 아웃으로 끝나는 유일한 길이다 */
  TAG: 3,
} as const

export type OutKind = (typeof OUT_KIND)[keyof typeof OUT_KIND]

export interface OutJudgement {
  readonly kind: OutKind
  /** 아웃이 난 주자 번호. 아웃이 없으면 −1 */
  readonly runnerIndex: number
}

export const NO_OUT: OutJudgement = { kind: OUT_KIND.NONE, runnerIndex: NONE }

/**
 * 주자관리 `vt10` = `0xa9f60` — "주자 i 가 아직 밀려 있나".
 * `0..i` 중 살아 있는 주자 수가 주자 i 의 **마지막으로 닿은 루(+0x8c)** 보다 많으면 참.
 */
export function isStillForced(runners: readonly RunnerState[], index: number): boolean {
  const self = runners[index]
  if (self === undefined || index < 0 || runners.length === 0) return true
  let live = 0
  for (let k = 0; k <= index; k += 1) {
    const runner = runners[k]
    if (runner === undefined) continue
    if (!runner.isOut) live += 1
    if (k === index) return live > runner.startBase
  }
  return true
}

/** 원본의 `x − (x/4)*4` — C 의 잘림 나눗셈이라 **부호가 남는다**(−1 → −1) */
function mod4(value: number): number {
  return value % 4
}

/** 야수.vt18 / 주자.vt18 = 0xbf3a0 — 위치가 목표점에 닿았나 */
function fielderStopped(fielder: FielderState): boolean {
  return isSamePoint(fielder.position, fielder.target)
}

/** 야수.vt58 = 0xa0ae4 — 발밑 루 번호, 없으면 −1 */
export function baseUnderFoot(fielder: FielderState): number {
  for (let base = 0; base < 4; base += 1) {
    if (isSamePoint(fielder.position, basePosition(base))) return base
  }
  return NONE
}

export interface OutJudgementInput extends DefenseContext {
  /**
   * 판정에서 빼 놓을 주자 번호들.
   *
   * 이 진행기의 규약 "타자주자의 운명은 **결과 코드**가 정한다" 때문에 부르는 쪽이 0번을 빼 준다.
   * 원본에는 이런 제외가 없다 — **근사**다.
   */
  readonly skipRunnerIndexes?: readonly number[]
}

/** 아웃 판정 한 번 (0xb36d0). 아웃이 하나 나면 거기서 멈추고 돌려준다 */
export function judgeOut(input: OutJudgementInput): OutJudgement {
  const { play, fielders, runners } = input
  const skip = input.skipRunnerIndexes ?? []
  // 0xb0c90 = 야수[P+0x130] — "이 플레이의 야수"
  const fielder = fielders[play.ballHolderSlot]

  for (let index = runners.length - 1; index >= 0; index -= 1) {
    const runner = runners[index]
    if (runner === undefined) continue
    if (runner.isOut) continue
    if (skip.includes(index)) continue

    const requiredBase = mod4(runner.requiredBase)
    const targetBase = mod4(runner.targetBase)
    // P+0x153 대상 루 거르개는 늘 −1 로 본다 (근사) → 모든 주자가 통과한다
    const filter = NONE
    if (filter !== NONE && filter !== targetBase) continue

    const runnerStopped = isRunnerStopped(runner)
    const footBase = fielder === undefined ? NONE : baseUnderFoot(fielder)
    const holderReady = fielder !== undefined && play.held && fielderStopped(fielder)
    let kind: OutKind = OUT_KIND.NONE

    // ── 3a 0xb380e — 태그. 공 쥔 야수와의 거리 ≤ 499 이고 주자가 루에 안 붙었다
    if (
      fielder !== undefined &&
      play.held &&
      horizontalDistance(fielder.position, runner.position) <= TAG_DISTANCE &&
      !runnerStopped
    ) {
      kind = OUT_KIND.TAG
    }

    // ── 1 0xb3834 — 뜬공 노바운드 포구
    if (runner.isBatterRunner && !play.everHeld && play.held) kind = OUT_KIND.FLY

    // ── 2a 0xb3890 — 공 쥔 야수가 **주자가 달려가는 루**를 밟고 있고, 그 주자가 아직 밀려 있다.
    // 평범한 포스(루) 아웃이 여기서 난다.
    if (
      holderReady &&
      footBase === targetBase &&
      runner.targetBase !== 0 &&
      isStillForced(runners, index) &&
      !runnerStopped
    ) {
      kind = OUT_KIND.BASE
    }

    // ── 2b 0xb38e4 — 공 쥔 야수가 주자의 **요구 루**(포스)를 밟고 있다
    if (requiredBase !== NONE && !runnerStopped && holderReady && footBase === requiredBase) {
      kind = OUT_KIND.BASE
    }

    // ── 3b 0xb3938 — **옮기지 않았다** (머리말 "이 옮김의 근사" 마지막 항목)

    if (kind !== OUT_KIND.NONE) return { kind, runnerIndex: index }
  }
  return NO_OUT
}

/**
 * 아웃이 난 뒤의 포스 풀기 **0xa9648** (0xb36d0 꼬리가 부른다).
 *
 * 주자 0번부터 훑다가 **죽은 주자를 만나면 그때부터** — 그 주자를 포함해 —
 * `요구 루(+0x88) > 마지막으로 닿은 루(+0x8c)` 인 주자의 `+0x94 = 0, +0x88 = −1` 로 포스를 푼다.
 * (`a9670: r2 = [r0,#0x10]`(+0x88) · `r3 = [r0,#0x14]`(+0x8c) · `ble` 면 건너뜀.) 원본 순서 그대로다.
 */
export function releaseForcesAfterOut(runners: readonly RunnerState[]): readonly RunnerState[] {
  let seenOut = false
  return runners.map((runner) => {
    if (runner.isOut) seenOut = true
    if (!seenOut) return runner
    if (runner.requiredBase <= runner.startBase) return runner
    return { ...runner, requiredBase: NONE }
  })
}
