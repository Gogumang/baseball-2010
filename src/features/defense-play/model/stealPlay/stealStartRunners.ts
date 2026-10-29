import { runnerSpeedOf } from '@/entities/fielding/model/fieldGeometry'
import type { BaseState } from '@/entities/game/model/baseState'
import type { StealPlayInput } from '@/features/defense-play/model/stealPlay/stealPlayTypes'

/** 찬 루 오름차순(0xa9a10) — 1 · 2 · 3 루 중 주자가 있는 루 */
export function occupiedBasesOf(bases: BaseState): (1 | 2 | 3)[] {
  return ([1, 2, 3] as const).filter((base) => bases[OCCUPIED_OF[base]])
}

const OCCUPIED_OF: Readonly<Record<1 | 2 | 3, keyof BaseState>> = { 1: 'first', 2: 'second', 3: 'third' }

/** 주자 능력(루별 → 공통 → 평균) · 팀 등급으로 정한 주자 속도 */
export function stealRunnerSpeedOf(input: Pick<StealPlayInput, 'runAbilities' | 'runAbility' | 'runnerTeamGrade'>, base: 1 | 2 | 3): number {
  return runnerSpeedOf(input.runAbilities?.[base] ?? input.runAbility ?? DEFAULT_ABILITY, input.runnerTeamGrade ?? 0)
}

/** 능력치를 안 주면 쓰는 값 — 원본 평균대(등급 3) */
export const DEFAULT_ABILITY = 500
