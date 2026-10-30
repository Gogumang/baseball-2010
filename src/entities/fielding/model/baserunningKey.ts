import { SLIDING_SPEED_BONUS } from '@/entities/fielding/model/fieldGeometry'
import { isPathClear } from '@/entities/fielding/model/autoAdvance'
import type { RunnerState } from '@/entities/fielding/model/fieldingState'
import { isStealAllowedInPlayKind } from '@/entities/fielding/model/stealStart'

/**
 * **사람 주루 키** — 상태 0x17 키 0x53420 → 0x5331c 가 보내는 메시지 0x582(진루) · 0x584(귀루)의 처리 (직접 뜬 것, 2026-10-16).
 *
 * 키 → 메시지는 `entities/defense-controls/model/defenseKeys.inPlayCommandOf` 다('2'/위 · '4'/왼 · '8'/아래 · '0' 진루,
 * '3' · '1' · '7' · CLR 귀루). 0x53420 은 조작 [+0xc] == 0(사람이 공격)이면 판 종류를 안 보고 0x5331c 를 부른다 — 곧 타구 판뿐
 * 아니라 **도루 · 폭투 · 견제 판에서도** 키가 나간다. 판 종류는 아래 0xa9b04 머리의 0xae794 가 거른다.
 *
 * ## 메시지 처리 (경기 장면 vt12 0x509a0 의 두 갈래)
 * ```
 * 0x5209e (0x582 진루)                          0x5222a (0x584 귀루)
 *   플레이(+0x200)+0x111 ≠ 0 → 끝                  같다
 *   경기+0x24 = 0                                  같다
 *   r = 0xa9b04(주자관리 +0x20c, 인자, 0)         r = 0xa9b04(주자관리, 인자, 1)
 *   r ≠ 0 → 플레이+0x128 = 1                       같다
 * ```
 * 플레이 +0x111 은 사건 코드 8(홈런, 0xb2bd8)이 세우는 칸이다. +0x128 은 CPU 송구 결정(0xafa60)을 다시 부르는 "송구 필요" 칸.
 *
 * ## 0xa9b04(주자관리, 인자, 방향) — a9b04~a9bca
 * ```
 * a9b0a  0xae794(관리+0x14) — 판 종류 state[0x26] ∈ {1, 4, 5, 9}(마스크 0x232) 아니면 0
 * a9b1e  인자 == −1:  방향 ≠ 0(귀루) → 1, 2, 3 차례로 자기 자신 · 방향 == 0(진루) → 3, 2, 1 차례 — 결과는 OR
 * a9b5a  r = 0xa97a0(관리, 인자)  — 목록 앞에서부터 산(+0x96 == 0) 주자 가운데 **+0x8c(마지막으로 닿은 루) == 인자** 인 첫 주자
 * a9b64  i = 0xa9ad4(관리, r)     — 그 주자의 목록 번호. r 없으면 0
 * a9b72  방향 ≠ 0(귀루): 0xa99a8(관리, i) 참이면 경기+0x24 = 1 · r.vt48(r.+0x8c)            → 1
 * a9b98  방향 == 0(진루): 0xa9924(관리, i) 참이면 경기+0x24 = 1 · r.vt48(0xb6228(r+0x78))   → 1
 *        (0xb6228 = +0x8c ≤ 3 ? +0x8c + 1 : +0x8c — 3루 주자는 홈 4)
 * ```
 * 곧 인자는 "투구 때 그 루의 주자"(+0x90)가 아니라 **지금 마지막으로 닿은 루(+0x8c)** 로 찾는다. 진루 목표도 지금 달려가는 루
 * (+0x7c) + 1 이 아니라 **+0x8c + 1** 이다 — 1루에서 2루로 가는 주자에게 진루 키를 눌러도 목표는 그대로 2루다.
 *
 * ## 귀루 검사 0xa99a8(관리, i) — a99a8~a99d4
 * ```
 * a99b0  t = 주자[i].+0x7c ; t ≤ 1 → 0                         ; 1루(또는 홈)로 가는 주자는 못 되돌린다
 * a99b6  b = 0xa97fc(관리, i) — 목록 번호 i−1 부터 내려가며 처음 만나는 산 주자. 없으면 → 1
 * a99c2  t − 1 ≤ b.+0x8c → 0 , 아니면 1                        ; 뒤 주자가 이미 닿은 루까지는 못 물러난다
 * ```
 * 진루 검사 0xa9924 는 도루 출발 · 자동 진루와 같은 앞길 검사다(`autoAdvance.isPathClear`).
 *
 * ## vt48 = 0xa07b0(주자, b) — 목표 루 바꾸기
 * 0x9ff38(+0xb8 슬라이딩 중)이면 +0xb8 = 0 · vt44(0)(0xa0164 — 속도 = vt64(), 슬라이딩 +40 을 걷는다) → +0x80 = b →
 * |b − +0x8c| > 1 이면 한 칸씩(여기서는 늘 0 · 1 이라 안 걸린다) → 바뀌면 +0x84 = 옛 +0x7c → +0x7c = b → 0xa0a18 이동 목표점.
 * **+0x8c(닿은 루) · 위치는 안 바뀐다**(구간 출발점은 아래 `retargetRunner` 주석).
 *
 * 난수 굴림 없음.
 */

/** 0x582 진루 · 0x584 귀루 */
export type BaserunningKeyKind = '진루' | '귀루'
/** 메시지 인자 — 1 · 2 · 3 = +0x8c 가 그 루인 주자, '전원' = −1 */
export type BaserunningKeyTarget = 1 | 2 | 3 | '전원'

export interface BaserunningKeyInput {
  /** 플레이 종류 state[0x26] (= 플레이 +0x118) */
  readonly playKind: number
  /** 플레이 +0x111 — 홈런(사건 코드 8)이 섰다. 서면 메시지가 아무것도 안 한다 */
  readonly homeRunFlag: boolean
  /** 주자 목록 — 원본 목록 순서(목록 번호 = 배열 첨자) */
  readonly runners: readonly RunnerState[]
  /** 주자 +0x84 (직전 목표 루) — 목록 번호별. 앞길 검사의 방향 판정 0x9fe80 이 본다 */
  readonly previousTargets: readonly number[]
}

export interface BaserunningKeyResult {
  /** 0x5209e · 0x5222a 의 +0x111 문을 지났다 — 경기+0x24 = 0 을 적었다 */
  readonly handled: boolean
  /** 0xa9b04 가 참 — 플레이+0x128 = 1 (송구 필요) · 경기+0x24 = 1 */
  readonly succeeded: boolean
  /** vt48 을 받은 주자의 목록 번호 (부른 차례) */
  readonly retargeted: readonly number[]
  /** 바뀐 주자 목록 (목록 순서 그대로) */
  readonly runners: readonly RunnerState[]
  /** 바뀐 +0x84 */
  readonly previousTargets: readonly number[]
}

/** 산 주자 — +0x96 == 0. 득점(0xaa0a8 → aa1da 0xa9520)도 +0x96 을 세운다 */
function isAlive(runner: RunnerState): boolean {
  return !runner.isOut && !runner.scored
}

/** 0xa97a0(관리, 루) — 목록 앞에서부터 +0x8c == 루 인 산 주자의 목록 번호. 없으면 −1 */
export function runnerIndexOnBase(runners: readonly RunnerState[], base: number): number {
  return runners.findIndex((runner) => isAlive(runner) && runner.startBase === base)
}

/** 0xa97fc(관리, i) — 목록 번호 i−1 부터 내려가며 처음 만나는 산 주자. 없으면 undefined */
function aliveRunnerBehind(runners: readonly RunnerState[], index: number): RunnerState | undefined {
  for (let at = index - 1; at >= 0; at -= 1) {
    const runner = runners[at]
    if (runner !== undefined && isAlive(runner)) return runner
  }
  return undefined
}

/** 귀루 검사 0xa99a8(관리, i) */
export function canReturnRunner(runners: readonly RunnerState[], index: number): boolean {
  const runner = runners[index]
  if (runner === undefined) return false
  const target = runner.targetBase
  if (target <= 1) return false
  const behind = aliveRunnerBehind(runners, index)
  if (behind === undefined) return true
  return target - 1 > behind.startBase
}

/** 0xb6228(주자+0x78) — +0x8c ≤ 3 이면 +1 */
function nextBaseFrom(touched: number): number {
  return touched <= 3 ? touched + 1 : touched
}

/** vt48 = 0xa07b0 — 슬라이딩 풀기 · +0x84 · +0x7c (닿은 루 · 위치 · 구간 출발점은 그대로) */
export function retargetRunner(
  runner: RunnerState,
  previousTarget: number,
  base: number,
): { readonly runner: RunnerState; readonly previousTarget: number } {
  let next = runner
  if (next.sliding) next = { ...next, sliding: false, speed: next.speed - SLIDING_SPEED_BONUS }
  const changed = next.targetBase !== base
  const nextPrevious = changed ? next.targetBase : previousTarget
  // 웹 진행기는 +0x94 판정끝 표시(`settled`)를 도착 0xa040c 의 "이미 처리함" 표시로도 쓴다 — 새 목표를 받으면 다시 닿을 수 있게 내린다.
  // 구간 출발점(`legStart`)은 웹 진행기들의 `startLeg` 관례대로 목표가 바뀐 자리에서 새로 잡는다(웹 진행률이 이 칸을 본다).
  // 원본 +0x14 는 vt48 이 아니라 주자 틱 0xbf094 의 vt28(0xbf240)이 움직인 틱마다 위치로 적는다 — 주자는 늘 땅(+0x24 = +0x18 + 0)이라
  // 늘 선다(r276 직접 뜸). 그 값을 읽는 협살 대상 0xb398c 의 0xbf01c 는 `legTotalTicksOf` 가 위치로 잰다
  next = changed ? { ...next, targetBase: base, settled: false, legStart: next.position } : { ...next, targetBase: base, settled: false }
  return { runner: next, previousTarget: nextPrevious }
}

/**
 * 메시지 0x582 / 0x584 한 번 (0x5209e / 0x5222a → 0xa9b04). 같은 메시지 안에서 앞 주자의 vt48 이 뒤 주자의 검사에 보인다
 * (전원 갈래의 차례가 그래서 뜻이 있다).
 */
export function applyBaserunningKey(input: BaserunningKeyInput, kind: BaserunningKeyKind, target: BaserunningKeyTarget): BaserunningKeyResult {
  const runners = [...input.runners]
  const previousTargets = runners.map((runner, index) => input.previousTargets[index] ?? runner.startBase)
  const retargeted: number[] = []
  if (input.homeRunFlag) return { handled: false, succeeded: false, retargeted, runners, previousTargets }

  const one = (base: number): boolean => {
    if (!isStealAllowedInPlayKind(input.playKind)) return false
    const index = runnerIndexOnBase(runners, base)
    if (index < 0) return false
    const runner = runners[index]!
    if (kind === '귀루') {
      if (!canReturnRunner(runners, index)) return false
      apply(index, runner.startBase)
      return true
    }
    const ok = isPathClear(runner, runners, (runnerIndex) => {
      const at = runners.findIndex((candidate) => candidate.index === runnerIndex)
      return at < 0 ? runner.startBase : (previousTargets[at] ?? runners[at]!.startBase)
    })
    if (!ok) return false
    apply(index, nextBaseFrom(runner.startBase))
    return true
  }
  const apply = (index: number, base: number) => {
    const moved = retargetRunner(runners[index]!, previousTargets[index]!, base)
    runners[index] = moved.runner
    previousTargets[index] = moved.previousTarget
    retargeted.push(index)
  }

  const everyone = (): boolean => {
    // a9b1e — 인자 −1 갈래도 머리의 0xae794 를 먼저 지난다(거짓이면 갈래 없이 0)
    if (!isStealAllowedInPlayKind(input.playKind)) return false
    const order = kind === '귀루' ? [1, 2, 3] : [3, 2, 1]
    let succeeded = false
    for (const base of order) succeeded = one(base) || succeeded
    return succeeded
  }

  const succeeded = target === '전원' ? everyone() : one(target)
  return { handled: true, succeeded, retargeted, runners, previousTargets }
}
