import type { BaseState } from '@/entities/game/model/baseState'

/**
 * **루에 선 주자의 신원** — 원본 주자 목록 객체(sim+0x80: 주자 4칸 [+8] · 개수 [+0xc])를 루별로 편 것.
 *
 * 원본은 새 주자를 `0xa93ac` 가 먼저 `0xa9374`(칸 i ← i−1, 0번 비우기)로 **0번 칸에 끼워** 넣는다 — 0번이 가장 최근 주자
 * (타자주자), 끝 칸(n−1)이 가장 오래된 = 가장 앞선 주자다 (E 3g). 간이 엔진의 진루(`0xc0fb4(sim, n)` — 안타 · 볼넷 c1918 ·
 * 도루 c1a0e · 땅볼 진루 0xc15b8)는 목록 **전원**을 같은 수만큼 밀기 때문에 주자가 서로 앞지르지 않고, 목록 차례가 곧
 * 루 차례다. 그래서 루별 신원(`first` · `second` · `third`)으로 들어도 목록과 같다.
 *
 * 신원 값은 **공격 팀 타순 칸**이다(사람 경기 `GameState` 는 0~8, 반 이닝 엔진은 그 반 이닝의 타순 커서). 선수는 그 칸의
 * 명단(`rosterSlotAt`)으로 찾는다 — 원본 주자 객체가 선수 레코드를 직접 드는 것과 달리 루에 선 동안 그 칸 선수가 바뀌는
 * 길(대주자)은 웹에 없다.
 */
export interface BaseRunners {
  readonly first: number | null
  readonly second: number | null
  readonly third: number | null
}

export const EMPTY_BASE_RUNNERS: BaseRunners = { first: null, second: null, third: null }

export type BaseNumber = 1 | 2 | 3

export function runnerOnBase(runners: BaseRunners, base: BaseNumber): number | null {
  return base === 1 ? runners.first : base === 2 ? runners.second : runners.third
}

/** 신원이 루 상황과 맞는가 — 찬 루마다 신원이 있고 빈 루에는 없다 */
export function runnersFitBases(runners: BaseRunners | undefined, bases: BaseState): runners is BaseRunners {
  if (runners === undefined) return false
  return (
    (runners.first !== null) === bases.first &&
    (runners.second !== null) === bases.second &&
    (runners.third !== null) === bases.third
  )
}

/**
 * 신원을 모르는 루(옛 저장 · 신원을 안 고친 길)의 **예전 근사** — 루 b 의 주자를 지금 타순 커서에서 거꾸로 b 번째로 본다.
 * 들고 있는 신원이 루 상황과 맞으면 그것을 쓴다.
 */
export function effectiveRunnersOf(
  bases: BaseState,
  runners: BaseRunners | undefined,
  orderBack: (ordersBack: number) => number,
): BaseRunners {
  if (runnersFitBases(runners, bases)) return runners
  return {
    first: bases.first ? orderBack(1) : null,
    second: bases.second ? orderBack(2) : null,
    third: bases.third ? orderBack(3) : null,
  }
}

/** 앞선 주자부터 (3루 → 1루) */
function leadFirstOf(runners: BaseRunners): number[] {
  return [runners.third, runners.second, runners.first].filter((runner): runner is number => runner !== null)
}

/** 앞선 주자부터의 목록을 찬 루에 앞선 루부터 앉힌다 — 모자라면 null */
function seatLeadFirst(list: readonly number[], bases: BaseState): BaseRunners {
  const seats: (number | null)[] = [null, null, null]
  let index = 0
  for (const base of [3, 2, 1] as const) {
    if (base === 3 ? bases.third : base === 2 ? bases.second : bases.first) seats[base - 1] = list[index++] ?? null
  }
  return { first: seats[0] ?? null, second: seats[1] ?? null, third: seats[2] ?? null }
}

export interface ShiftedRunners {
  readonly runners: BaseRunners
  /** 홈을 밟은 주자 (앞선 주자부터) */
  readonly scored: readonly number[]
}

/**
 * **`0xc0fb4(sim, n)` — 목록 전원 루 += n**, 4 이상이면 득점. `batter` 를 주면 먼저 `0xa93ac` 로 0번 칸(루 0)에 끼운다.
 * 간이 엔진의 안타(n 루) · 볼넷(c1918, n = 1) · 도루(n = 1) · 땅볼 진루(n = 1)가 모두 이 길이다.
 */
export function shiftRunners(runners: BaseRunners, n: number, batter: number | null = null): ShiftedRunners {
  const placed: (readonly [number, number])[] = []
  if (batter !== null) placed.push([batter, 0])
  if (runners.first !== null) placed.push([runners.first, 1])
  if (runners.second !== null) placed.push([runners.second, 2])
  if (runners.third !== null) placed.push([runners.third, 3])
  const seats: (number | null)[] = [null, null, null]
  const scored: number[] = []
  // 앞선 주자부터 득점이 난다
  for (const [runner, base] of [...placed].reverse()) {
    const to = base + n
    if (to >= 4) scored.push(runner)
    else if (to >= 1) seats[to - 1] = runner
  }
  return { runners: { first: seats[0] ?? null, second: seats[1] ?? null, third: seats[2] ?? null }, scored }
}

export interface RunnerChange {
  /** 이 플레이의 타자 (타순 칸) */
  readonly batter: number
  /** 타자가 살아 나갔나 — 안타 · 볼넷 · 사구 */
  readonly batterReached: boolean
  readonly runsScored: number
  /**
   * 수비 진행기를 돈 판의 **살아남은 주자**(득점도 아웃도 아닌) — 투구 때 서 있던 루(0 = 타자주자). 주면 이것으로 앉힌다
   * (`runnerFates` 의 `fromBase` · `scored` · `retired`).
   */
  readonly survivorsFromBase?: readonly number[]
}

/**
 * 플레이 하나 뒤의 신원 — 주자는 서로 앞지르지 못하므로(원본 목록 차례 = 루 차례) 살아남은 주자를 **앞선 주자부터** 다음 루
 * 상황의 찬 루에 앉힌다.
 * - 살아남은 주자(`survivorsFromBase`)를 주면 그대로.
 * - 안 주면: 앞선 주자부터 [3루, 2루, 1루, (나간 타자)] 에서 득점 수만큼 앞에서 빼고, 남는 수가 찬 루보다 많으면 타자 바로 앞
 *   (가장 뒤의) 주자부터 아웃으로 본다 — ⚠️ 근사(수비 진행기 결과의 아웃 주자를 모를 때만). 모자라면 타자를 넣는다.
 */
export function runnersAfterPlay(before: BaseRunners, next: BaseState, change: RunnerChange): BaseRunners {
  if (change.survivorsFromBase !== undefined) {
    const list = [...change.survivorsFromBase]
      .sort((a, b) => b - a)
      .map((fromBase) => (fromBase === 0 ? change.batter : runnerOnBase(before, fromBase as BaseNumber)))
    if (list.every((runner) => runner !== null)) {
      const seated = seatLeadFirst(list as number[], next)
      if (runnersFitBases(seated, next) && list.length === Number(next.first) + Number(next.second) + Number(next.third)) {
        return seated
      }
    }
  }
  const occupied = Number(next.first) + Number(next.second) + Number(next.third)
  const runners = leadFirstOf(before).slice(Math.max(0, change.runsScored))
  let batterIn = change.batterReached && change.runsScored <= leadFirstOf(before).length
  while (runners.length + Number(batterIn) > occupied && runners.length > 0) runners.pop()
  if (runners.length + Number(batterIn) > occupied) batterIn = false
  if (runners.length + Number(batterIn) < occupied && !batterIn) batterIn = true
  return seatLeadFirst(batterIn ? [...runners, change.batter] : runners, next)
}
