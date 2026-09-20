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
 */

/** 자동 진루를 아예 보지 않는 플레이 종류 (2 볼넷 밀어내기 · 3 · 8 홈런더비) */
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
  if (SKIPPED_PLAY_KINDS.has(play.kind)) return []
  if (play.finished || play.suppressed) return []
  // vt94 = "뜬공이 잡힐 예정" (+0x11c ≤ 낙구 틱)
  const willBeCaught = play.earliestCatchTick <= input.landingTick
  if (willBeCaught && !play.everHeld) return []

  const pathClear = input.isPathClear ?? defaultPathClear
  const decisions: AutoAdvanceDecision[] = []
  for (let index = runners.length - 1; index >= 0; index -= 1) {
    const runner = runners[index]
    if (runner === undefined || runner.isOut) continue
    if (isRunnerStopped(runner) && input.force !== true) continue

    // 종류 7 은 틱 비교 없이 바로 진루한다 (목표가 이미 출발루+2 이상이면 건너뜀)
    if (play.kind === 7) {
      if (runner.targetBase >= runner.startBase + 2) continue
      decisions.push({ runnerIndex: runner.index, toBase: runner.targetBase + 1 })
      continue
    }

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
