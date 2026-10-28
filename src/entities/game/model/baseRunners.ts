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
  return (runners.first !== null) === bases.first && (runners.second !== null) === bases.second && (runners.third !== null) === bases.third
}

/**
 * 신원을 모르는 루(옛 저장 · 신원을 안 고친 길)의 **예전 근사** — 루 b 의 주자를 지금 타순 커서에서 거꾸로 b 번째로 본다.
 * 들고 있는 신원이 루 상황과 맞으면 그것을 쓴다.
 */
export function effectiveRunnersOf(bases: BaseState, runners: BaseRunners | undefined, orderBack: (ordersBack: number) => number): BaseRunners {
  if (runnersFitBases(runners, bases)) return runners
  return {
    first: bases.first ? orderBack(1) : null,
    second: bases.second ? orderBack(2) : null,
    third: bases.third ? orderBack(3) : null,
  }
}

/** 타순 아홉 칸 */
const LINEUP_SLOTS = 9

/**
 * **루 상황 세우기 `0xa9a10(주자관리, 공격 팀, 수비 팀, 루표)`** — 루표만 들고 주자를 새로 세우는 곳(미션 시작 상황 0xaae7c aafbc ·
 * 자동진행 멈춤 판 0xc22b4 c237a, 둘 다 `0xa9a9c` 를 거쳐 온다. 공격 팀 = 장면 팀 칸[st[9]] · sim+0x74). 직접 떴다:
 * ```
 * a9a20  0xa9250 주자 지우기 ; k = 0
 * a9a24  루 b = 3, 2, 1 (r7 내려 센다):
 * a9a28    루표[b] == 0 → 건너뜀
 * a9a32    k += 1
 * a9a3a    선수 = 0xae8b9(공격 팀, k)      ; 0xb8a35(팀, 팀[0xca911(팀+0x32 − k + 9, 9) + 0xe]) — 지금 타자 칸에서 거꾸로 k 번째 타순 칸
 * a9a44    0xb8681(공격 팀) · 0xae83d(수비 팀)(지금 투수 = 내보낸 투수)
 * a9a5a    0xa93ac(관리, 선수, …) — 0번 칸에 끼운다 · a9a6c 그 주자를 루 b 에
 * ```
 * 그래서 **가장 앞선 찬 루가 바로 앞 타자**(커서 − 1)이고 뒤 루로 갈수록 더 앞 타순이다 — 예전 근사(루 b = 커서 − b)와 다르다
 * (만루면 3루 = −1 · 2루 = −2 · 1루 = −3, 1·3루면 3루 = −1 · 1루 = −2). 신원 값은 타순 칸(0~8).
 */
export function runnersBehindCursor(bases: BaseState, cursor: number): BaseRunners {
  const seats: (number | null)[] = [null, null, null]
  let k = 0
  for (const base of [3, 2, 1] as const) {
    if (!(base === 3 ? bases.third : base === 2 ? bases.second : bases.first)) continue
    k += 1
    seats[base - 1] = (((cursor - k) % LINEUP_SLOTS) + LINEUP_SLOTS) % LINEUP_SLOTS
  }
  return { first: seats[0] ?? null, second: seats[1] ?? null, third: seats[2] ?? null }
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

/**
 * **밀어내기 진루** — 타자가 1루에 들고 밀려난 주자만 한 루 간다(만루면 3루 주자 득점).
 * 원본 간이 엔진 볼넷(c1918)은 `shiftRunners(…, 1, 타자)` 로 전원을 밀지만(원본 버그 B-14), 고친 길은 이 함수를 쓴다.
 */
export function forceRunners(runners: BaseRunners, batter: number): ShiftedRunners {
  if (runners.first === null) return { runners: { ...runners, first: batter }, scored: [] }
  if (runners.second === null) return { runners: { ...runners, first: batter, second: runners.first }, scored: [] }
  if (runners.third === null) {
    return { runners: { first: batter, second: runners.first, third: runners.second }, scored: [] }
  }
  return { runners: { first: batter, second: runners.first, third: runners.second }, scored: [runners.third] }
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
 * - 살아남은 주자(`survivorsFromBase`)를 주면 그대로 — 수비 진행기 판은 그 판의 주자 운명(`runnerFates`), 진행기를 안 도는
 *   삼진 · 볼넷 · 사구 · 홈런은 정산 0xa8024 가 보는 목록 그대로(`survivorsWithoutPlayOf`).
 * - 안 주었거나 살아남은 주자 수가 다음 루 상황의 찬 루 수와 다르면: 앞선 주자부터 [3루, 2루, 1루, (나간 타자)] 에서 득점 수만큼
 *   앞에서 빼고, 남는 수가 찬 루보다 많으면 타자 바로 앞(가장 뒤의) 주자부터 아웃으로 본다 — ⚠️ 근사(남김 — 앱 길에서 지난다, r276).
 *   앱이 지나는 것은 둘이다(r276 전체 시험 계측): ① 3아웃으로 루가 비면(빈 신원 — 원본도 반 이닝 교대가 목록을 비운다) ② 운명의
 *   살아남은 주자 수가 진행기의 루 상황(`advance.bases`)보다 많은 판(커리어 · 투수 리그 soak · 미션 투수편에서 남) — 판이 닫힐 때
 *   아직 달리던 주자를 루에 앉히는 두 규칙이 어긋나는 자리로, 수비 진행기 몫이다. 운명 없이 안타 · 아웃이 오는 길(시험 · 옛 호출)도
 *   여기 온다 — 진행기를 도는 안타 · 아웃은 앱에서 늘 운명을 싣는다(타자편 · 팀 경기 · 투수편 · 미션).
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

/**
 * **수비 진행기를 안 도는 결과의 살아남은 주자** — 정산 0xa8024 가 읽는 주자 목록(`features/defense-play/runnerFates` 의
 * `runnerFatesWithoutPlay` 와 같은 규칙)에서 득점도 처리 끝도 아닌 주자의 투구 때 루(0 = 타자주자):
 * - 삼진: 0xae24c 가 판정 5 를 0x17 없이 정산으로 보낸다(0xae360) — 타자주자가 목록에 없고 루의 주자는 그대로
 * - 볼넷 · 사구: 플레이 종류 2(0x3e1cc) — 타자주자가 0번에 들고, 만루면 3루 주자가 홈을 밟는다(+0x95 · +0x96)
 * - 홈런: 0x17 에서 전원이 홈을 돈다 — 아무도 안 남는다
 * 안타 · 아웃은 진행기 결과의 운명으로만 안다 — null.
 */
export function survivorsWithoutPlayOf(bases: BaseState, outcomeKind: string): readonly number[] | null {
  const onBase = ([1, 2, 3] as const).filter((base) => (base === 1 ? bases.first : base === 2 ? bases.second : bases.third))
  if (outcomeKind === '삼진') return onBase
  if (outcomeKind === '홈런') return []
  if (outcomeKind === '볼넷' || outcomeKind === '사구') {
    const forcedHome = bases.first && bases.second && bases.third
    return [0, ...onBase.filter((base) => !(forcedHome && base === 3))]
  }
  return null
}
