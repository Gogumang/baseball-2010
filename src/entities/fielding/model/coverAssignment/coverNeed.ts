import { basePosition, isSamePoint, type WorldPoint } from '@/entities/fielding/model/fieldGeometry'
import { AI_STATE, NONE, type DefenseContext, type RunnerState } from '@/entities/fielding/model/fieldingState'

/** 목표점(+0x2c)이 루 좌표와 좌표까지 같은 첫 루 (0xb1268 · 야수 vt68 = 0xa0b4c) — 없으면 −1 */
export function baseAtPoint(point: WorldPoint): number {
  for (let base = 0; base <= 3; base += 1) {
    if (isSamePoint(point, basePosition(base))) return base
  }
  return NONE
}

/** 0xa97a0 — 아웃 아닌 주자 중 +0x8c(마지막으로 닿은 루) == b 인 첫 주자 */
function runnerOnBase(runners: readonly RunnerState[], base: number): RunnerState | undefined {
  return runners.find((runner) => !runner.isOut && runner.startBase === base)
}

/**
 * 플레이 `+0x168` — 0xb1b88 의 타자주자 갈래(b1bde)만 읽는 칸. 쓰는 곳이 바이너리에 없어(머리말) 생성 때 값 그대로다.
 * 생성 때 값은 0 — new 0x1238 → 0x2ac4 가 memset(p, 0, 크기)(0x1400428) 한다(r115 직접 뜸).
 */
export const PLAY_FIELD_0X168 = 0

/**
 * b1bde~b1c08 (직접 뜬 것): 주자 목록 0 번(0xa9564(…, 0))이 있고 아웃 아니고(+0x96 == 0)
 * `(P+0x168 − 12) ≤ 2 || (P+0x168 − 6) ≤ 2`(부호 없는 비교 `bls`) 면 1.
 */
export function batterRunnerNeedsCover(runners: readonly RunnerState[], playField168: number = PLAY_FIELD_0X168): boolean {
  const first = runners[0]
  if (first === undefined || first.isOut) return false
  return (playField168 - 12) >>> 0 <= 2 || (playField168 - 6) >>> 0 <= 2
}

/** b1bae — 그 루를 꼭 밟아야 하는(+0x94 · +0x88 == b) 살아 있는 주자가 있다 */
const someRunnerOwesBase = (runners: readonly RunnerState[], base: number) =>
  runners.some((runner) => runner.requiredBase !== NONE && runner.requiredBase === base && !runner.isOut)

/** b1c0a — r = b == 0 ? 4 : b ; 루 r · r−1 의 주자, 또는 루 r−2 에서 r−1 로 가는 주자 */
function runnerApproaches(runners: readonly RunnerState[], base: number): boolean {
  const r = base === 0 ? 4 : base
  if (runnerOnBase(runners, r) !== undefined) return true
  if (runnerOnBase(runners, r - 1) !== undefined) return true
  const twoBack = runnerOnBase(runners, r - 2)
  return twoBack !== undefined && twoBack.targetBase === r - 1
}

/** 0xb1b88(P, b) — 그 루에 커버가 필요한가 (`assignCoversForTick` 머리말 참고) */
export function needsCover(context: DefenseContext, base: number): boolean {
  const { fielders, runners } = context
  if (fielders.some((fielder) => fielder.aiState === AI_STATE.RUNDOWN)) return true
  if (someRunnerOwesBase(runners, base)) return true
  if (batterRunnerNeedsCover(runners)) return true
  return runnerApproaches(runners, base)
}
