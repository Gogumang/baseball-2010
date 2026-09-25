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
  const next = runner.targetBase + 1
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
    // 0xaf946~0xaf95a — 멈춘 주자(vt18 참)는 force 가 아니면 건너뜀
    if (isRunnerStopped(runner) && input.force !== true) continue

    // ── 0xaf96e · 0xaf978 — **끝남(+0x111) 이나 +0x129 가 서 있으면 틱 비교 없이 한 루 진루** ──
    // 두 검사 모두 `bne 0xafa0e` 로 **진루 자리로 곧장 뛴다**. 그러니 이 갈래에서는
    // 종류 2·3·8 거르개도, vt94(잡힐 뜬공) 도, 0xaf284 틱 비교도, 앞길 검사(0xa9924)도 **안 본다**.
    if (play.finished || play.suppressed) {
      decisions.push({ runnerIndex: runner.index, toBase: runner.targetBase + 1 })
      continue
    }

    // 종류 7 은 틱 비교 없이 바로 진루한다 (목표가 이미 출발루+2 이상이면 건너뜀)
    if (play.kind === 7) {
      if (runner.targetBase >= runner.startBase + 2) continue
      decisions.push({ runnerIndex: runner.index, toBase: runner.targetBase + 1 })
      continue
    }

    // ── 0xaf98e — vt94 = "뜬공이 잡힐 예정"(+0x11c ≤ 낙구 틱) 이고 아직 안 잡혔으면 아무도 안 뜀 ──
    // ── 0xaf9ac · 0xaf9b2 — 종류 2·3·8 은 아예 안 본다 ──
    // 둘 다 원본에서 **루프 밖이 아니라 이 자리**의 `b 0xafa38`(함수 끝) 이다. 두 조건 모두
    // 주자와 무관하니 결과는 같지만, 앞선 주자가 위 두 갈래로 이미 진루해 두었으면
    // 그 진루는 **남는다** — 그래서 `[]` 가 아니라 여기까지 모은 것을 돌려준다.
    if (play.earliestCatchTick <= input.landingTick && !play.everHeld) return decisions
    if (SKIPPED_PLAY_KINDS.has(play.kind)) return decisions

    const nextBase = (((runner.targetBase + 1) % 4) + 4) % 4
    const runTicks = ticksToReach(runner.position, basePosition(nextBase), runner.speed) + 1
    const defenseTicks = defenseArrivalTicks(input, nextBase)
    if (beatsThrow(runTicks, defenseTicks) && pathClear(runner, runners)) {
      decisions.push({ runnerIndex: runner.index, toBase: runner.targetBase + 1 })
    }
  }
  return decisions
}

/**
 * 공이 땅에 닿거나 담장선을 넘을 때 (0xa95e8) — **포스**.
 * 주자 i 마다 `목표 루 ≤ i` 면 요구 루 = 투구 때 있던 루 + 1, 아니면 −1.
 * (원본이 주자 번호 i 와 목표 루를 비교한다 — 그대로 옮긴다.)
 */
export function requiredBasesOnBounce(runners: readonly RunnerState[]): readonly number[] {
  return runners.map((runner, index) => (runner.targetBase <= index ? runner.pitchBase + 1 : NONE))
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
