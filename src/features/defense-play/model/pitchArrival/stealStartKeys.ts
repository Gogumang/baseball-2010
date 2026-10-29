import { type CpuStealInput, rollCpuSteal } from '@/entities/fielding/model/cpuSteal'
import { type StealBase, canStartSteal } from '@/entities/fielding/model/stealStart'
import type { BaseState } from '@/entities/game/model/baseState'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'
import { stealStartThrowDecision } from '@/features/defense-play/model/stealPlay'
import type { RandomPort } from '@/shared/api/random/randomPort'

/** 사람 공격의 도루 키 — `canStartSteal` 이 받으면 넣는다. 난수 없음. 못 받으면 같은 배열을 돌려준다 */
export function startHumanSteal(bases: BaseState, stealingFrom: readonly StealBase[], base: StealBase): readonly StealBase[] {
  if (!canStartSteal({ bases, alreadyStealing: stealingFrom }, base)) return stealingFrom
  return [...stealingFrom, base]
}

/** 사람 공격의 도루 키 '3'·'2'·'1' → 대상 주자의 루 (`0x53610`). 다른 키는 null */
export function stealBaseOfKey(key: string): StealBase | null {
  if (key === '3') return 1
  if (key === '2') return 2
  if (key === '1') return 3
  return null
}

/** 도루 출발 한 번의 수비 쪽 — 메시지 0x583 의 52222 `0xafa60` 이 보는 것 (공 도착 판과 같은 칸을 넘긴다) */
export interface StealStartDefenseInput {
  /** 앞 판이 남긴 수비 장면 — `playEnd` 가 없으면 굴림도 없다 */
  readonly scene: DefenseScene | undefined
  /** 투구 때 루 상황 */
  readonly bases: BaseState
  /** state[6] — 지금 아웃 수 (0xafb24 가 본다) */
  readonly outs: number
  readonly defenseAbilities?: readonly (number | null)[]
  /** 루별 주자 주루 (0 은 안 본다) */
  readonly runAbilities?: Partial<Record<0 | 1 | 2 | 3, number>>
  readonly runAbility?: number
  readonly runnerTeamGrade?: number
}

/**
 * **도루 출발 메시지 0x583 한 번의 수비 쪽** — 0x520de 가 0xa9bd4 로 주자를 출발시킨 바로 뒤 52222 의 `0xafa60`(CPU 송구 결정) 한 번
 * (`stealPlay.stealStartThrowDecision`). 바뀐 장면을 돌려준다 — 부르는 쪽은 경기 장면 칸(`defenseScene`)에 곧바로 적는다.
 * `stealingFrom` 은 지금까지 출발한 주자의 루를 **출발한 차례대로**(마지막이 이번 키) 준다.
 *
 * 굴림 자리 (r214 — 예전 웹은 공 도착 판 맨 앞에서 몰아 굴렸다):
 * - 사람 공격: 키 '3'·'2'·'1' 을 받은 그 자리(상태 0x11) — 그 뒤의 스윙 굴림보다 먼저.
 * - CPU 공격: 상태 0x11 의 10번째 틱 `0x537dc` → 0x583 — `rollCpuStealStart` 바로 뒤, 11번째 틱 CPU 타자 결정 `0x34334` 보다 먼저.
 * 판이 안 열리는 공(2아웃 삼진 · 맞힌 공)도 0xafa60 은 이미 돌았다 — 그 +0x128 = 0 · 던진 야수가 놓은 공이 장면에 남는다.
 */
export function stealStartSceneOf(input: StealStartDefenseInput, stealingFrom: readonly StealBase[], random: RandomPort): DefenseScene | undefined {
  if (stealingFrom.length === 0) return input.scene
  const runAbilities = input.runAbilities
  return stealStartThrowDecision({
    scene: input.scene,
    bases: input.bases,
    stealingFrom,
    outs: input.outs,
    defenseAbilities: input.defenseAbilities,
    runAbilities: runAbilities === undefined ? undefined : { 1: runAbilities[1], 2: runAbilities[2], 3: runAbilities[3] },
    runAbility: input.runAbility,
    runnerTeamGrade: input.runnerTeamGrade,
    random,
  }).scene
}

/**
 * CPU 공격의 도루 출발 — `0x520de`(rollCpuSteal) → `0xa9bd4`(canStartSteal).
 * 부르는 자리는 CPU 타자 결정 `0x34334` 굴림 **바로 앞**. 후보가 없으면 굴리지 않는다.
 */
export function rollCpuStealStart(input: CpuStealInput, random: RandomPort): readonly StealBase[] {
  const base = rollCpuSteal(input, random)
  if (base === null) return []
  return canStartSteal({ bases: input.bases }, base) ? [base] : []
}
