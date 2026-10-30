import { runnerSpeedOf } from '@/entities/fielding/model/fieldGeometry'
import { batterBoxPosition, createRunner, type RunnerState } from '@/entities/fielding/model/fieldingState'
import { applyRunnerLead, runnerLeadOf } from '@/entities/fielding/model/runnerLead'
import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { BaseState } from '@/entities/game/model/baseState'

/** 밀어내기 판 주자 목록에 쓰는 판 입력 칸 (`WalkPlayInput` 머리말) */
export interface WalkRunnerInput {
  readonly batterHand: number
  readonly bases: BaseState
  readonly runAbilities?: Partial<Record<0 | 1 | 2 | 3, number>>
  readonly runAbility?: number
  readonly runnerTeamGrade?: number
}

const DEFAULT_RUN_ABILITY = 500
/** 플레이 종류 2 — 0x3e1b4 0xb0cb8(플레이, 2) */
export const WALK_PLAY_KIND = 2

const isStealingFrom = (stealing: readonly StealBase[], base: number): boolean => stealing.includes(base as StealBase)

function speedOf(input: WalkRunnerInput, base: 0 | 1 | 2 | 3): number {
  return runnerSpeedOf(input.runAbilities?.[base] ?? input.runAbility ?? DEFAULT_RUN_ABILITY, input.runnerTeamGrade ?? 0)
}

/**
 * 0xa93ac 타자주자 — 목표 1 · 요구 루 1 · +0x94 · +0x98. 위치는 a9446 vt94 0xa0884 의 타석 자리(구간 출발점 legStart 는
 * 진행률 vt90 의 분모 자리라 홈 그대로 — 타구 판 `createPlayRunners` 와 같다). 그 뒤 찬 루 오름차순
 */
function createWalkRunners(input: WalkRunnerInput): RunnerState[] {
  const runners: RunnerState[] = [
    createRunner(0, 0, speedOf(input, 0), {
      targetBase: 1,
      requiredBase: 1,
      isBatterRunner: true,
      position: batterBoxPosition(input.batterHand),
    }),
  ]
  const occupied = { 1: input.bases.first, 2: input.bases.second, 3: input.bases.third } as const
  ;([1, 2, 3] as const).forEach((base) => {
    if (occupied[base]) runners.push(createRunner(runners.length, base, speedOf(input, base), { isBatterRunner: false }))
  })
  return runners
}

/** 0xa9e44 — 목록 1 부터: 포스(0xa9f60) || 도루 표시면 앞 주자 +0x7c ≥ 내 루일 때 다음 루 */
function withPushedTargets(runners: readonly RunnerState[], stealing: readonly StealBase[]): RunnerState[] {
  const pushed = [...runners]
  let previousTarget = runners[0].targetBase
  for (let index = 1; index < pushed.length; index += 1) {
    const runner = pushed[index]
    const base = runner.startBase
    const isStealing = isStealingFrom(stealing, base)
    const forced = index + 1 > base
    // 0xa9bd4 → vt48(0xb6228) — 도루 주자의 +0x7c 는 이미 다음 루, 아니면 vt88 이 제 루에 앉혔다
    const pushedOn = (forced || isStealing) && previousTarget >= base
    const target = pushedOn || isStealing ? base + 1 : base
    pushed[index] = { ...runner, targetBase: target }
    previousTarget = target
  }
  return pushed
}

/** 0x465b8 — 밀리는 사슬(+0x8c 가 앞 주자 + 1)이 처음 끊긴 자리 */
function pushChainEndOf(runners: readonly RunnerState[]): number {
  let chainEnd = 1
  while (chainEnd < runners.length && runners[chainEnd].startBase === runners[chainEnd - 1].startBase + 1) chainEnd += 1
  return chainEnd
}

/** 0x465b8 — 끊긴 자리부터, 도루 표시 주자는 +0x94 = 1 · 제 루로 (+0x88 = +0x8c — 웹은 +0x94 를 요구 루(≠ −1)로 읽는다) */
function withStealersHeldBack(runners: readonly RunnerState[], stealing: readonly StealBase[]): RunnerState[] {
  if (runners.length <= 1) return [...runners]
  const chainEnd = pushChainEndOf(runners)
  return runners.map((runner, index) => {
    if (index < chainEnd || !isStealingFrom(stealing, runner.startBase)) return runner
    return { ...runner, targetBase: runner.startBase, requiredBase: runner.startBase }
  })
}

/** 밀어내기 판 시작 주자 목록 — 타자주자 · 밀기(0xa9e44) · 리드(0x4657e) · 안 밀리는 도루 주자 되돌리기(0x465b8) */
export function walkPlayRunnersOf(input: WalkRunnerInput, stealing: readonly StealBase[]): RunnerState[] {
  const pushed = withPushedTargets(createWalkRunners(input), stealing)
  // 0x4657e — 주자마다 0x3d7b8 리드 (종류 2: 도루 주자 틱 0 · 그 밖 0xcffb0 틱 뒤 목표 되돌리기)
  const led = pushed.map((runner) =>
    applyRunnerLead(runner, runnerLeadOf(runner, { playKind: WALK_PLAY_KIND, stealing: isStealingFrom(stealing, runner.startBase) })),
  )
  return withStealersHeldBack(led, stealing)
}
