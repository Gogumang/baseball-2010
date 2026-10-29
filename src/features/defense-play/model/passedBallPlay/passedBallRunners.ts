import { runnerSpeedOf } from '@/entities/fielding/model/fieldGeometry'
import { type RunnerState, batterBoxPosition, createRunner } from '@/entities/fielding/model/fieldingState'
import { PASSED_BALL_PLAY_KIND } from '@/entities/fielding/model/passedBall'
import { applyRunnerLead, runnerLeadOf } from '@/entities/fielding/model/runnerLead'
import { type StealBase, stealTargetBaseOf } from '@/entities/fielding/model/stealStart'
import type { BaseState } from '@/entities/game/model/baseState'
import type { PassedBallPlayInput } from '@/features/defense-play/model/passedBallPlay/passedBallTypes'

/** 능력치를 안 주면 쓰는 값 — 원본 평균대(등급 3) */
export const DEFAULT_ABILITY = 500

/**
 * 주자 목록 — 타자주자(낫아웃이면) 맨 앞 + 찬 루 오름차순. 번호는 1 부터 — 0 은 타자주자 자리 (그림이 타자로 그리지 않게, 견제 진행기와 같다).
 * 0xa93ac: +0x88 = 1(요구 루) · +0x90 = 0 · +0x98 = 1(타자주자) · a9446 vt94 0xa0884 타석 자리(legStart 는 홈 그대로 — 진행률 분모)
 */
export function passedBallRunnersOf(input: PassedBallPlayInput, batterRuns: boolean): RunnerState[] {
  const runners: RunnerState[] = []
  if (batterRuns) {
    runners.push(
      createRunner(0, 0, passedBallRunnerSpeedOf(input, 0), {
        targetBase: 1,
        requiredBase: 1,
        isBatterRunner: true,
        position: batterBoxPosition(input.batterHand),
      }),
    )
  }
  for (const base of [1, 2, 3] as const) {
    if (!input.bases[OCCUPIED_OF[base]]) continue
    const index = batterRuns ? runners.length : runners.length + 1
    runners.push(createRunner(index, base, passedBallRunnerSpeedOf(input, base), { isBatterRunner: false }))
  }
  return runners
}

const OCCUPIED_OF: Readonly<Record<1 | 2 | 3, keyof BaseState>> = { 1: 'first', 2: 'second', 3: 'third' }

function passedBallRunnerSpeedOf(input: PassedBallPlayInput, base: 0 | 1 | 2 | 3): number {
  return runnerSpeedOf(input.runAbilities?.[base] ?? input.runAbility ?? DEFAULT_ABILITY, input.runnerTeamGrade ?? 0)
}

/**
 * **판 시작 목표 · 리드** — 상태 0x17 진입 0x46418 (직접 뜬 것):
 * ```
 * 464a8  state[0x11](맞은 공) || 종류 ∈ {2, 3} || 0xb6c3c(state[0x1a] 낫아웃) 가 아니면 4657e 로 — 종류 9 는 낫아웃일 때만 아래 둘
 * 4650e    0xa93ac 타자주자(목표 1 — vt48(1))
 * 4653e    주자관리.vt1c = 0xa9e44(vt94, +0x111, state[6]): 목록 1 번부터 — 도루 아니면 vt88(제 루), 포스(0..i 산 주자 수 > 루)
 *          || 아웃 == 2 || 도루면 앞 주자 +0x7c ≥ 루 → 목표 = 루 + 1 (종류 1 의 2아웃 갈래 a9efa 는 종류 9 에 없다).
 *          1루 예외(a9ed6)는 1루 주자 · 아웃 != 2 라 낫아웃(1루 빔 || 2아웃)과 안 겹친다
 * 4657e  주자 목록 차례로 0x3d7b8 리드 — 도루 주자 0xcffa8[루] + rand(0,9) 틱 · 목표 그대로, 그 밖 0xcffb0[루](+ 번트 3) 틱 뒤 되돌리기
 * 465ca  사슬 끊긴 도루 주자 되돌리기는 종류 2·3 만 — 종류 9 엔 없다
 * ```
 * 낫아웃이 아니면 0xa9e44 가 안 돌아 도루 안 한 주자의 목표는 제 루, 도루 주자는 0xa9bd4 가 세운 다음 루 그대로다.
 * 굴림은 도루 주자마다 rand(0,9) 한 번(목록 차례) — 0x3507c 의 두 굴림 뒤 · 판 틱 굴림 앞.
 */
export function leadRunnersForPassedBall(runners: RunnerState[], input: PassedBallPlayInput, batterRuns: boolean): void {
  const stealing = input.stealingFrom ?? []
  let previousTarget = Number.NEGATIVE_INFINITY
  for (let index = 0; index < runners.length; index += 1) {
    const runner = runners[index]
    if (runner.isBatterRunner) {
      previousTarget = runner.targetBase
      continue
    }
    const target = openingTargetOf(runner, { index, previousTarget, stealing, batterRuns, outs: input.outs })
    previousTarget = target
    runners[index] = { ...runner, targetBase: target }
  }
  // 0x3d7b8 리드 — 주자 목록 차례로 (도루 주자는 rand(0,9) 한 번)
  for (let index = 0; index < runners.length; index += 1) {
    const runner = runners[index]
    const lead = runnerLeadOf(runner, {
      playKind: PASSED_BALL_PLAY_KIND,
      stealing: !runner.isBatterRunner && stealing.includes(runner.startBase as StealBase),
      buntKind: input.buntKind,
      random: input.random,
    })
    runners[index] = applyRunnerLead(runner, lead)
  }
}

interface ChainFacts {
  readonly index: number
  /** 앞 주자의 목표 (+0x7c) */
  readonly previousTarget: number
  readonly stealing: readonly StealBase[]
  readonly batterRuns: boolean
  readonly outs: number
}

/** 0xa9e44 — 도루면 다음 루, 낫아웃이면 포스 · 2아웃 · 도루일 때 앞 주자 +0x7c ≥ 루 → 루 + 1 */
function openingTargetOf(runner: RunnerState, facts: ChainFacts): number {
  const base = runner.startBase
  const isStealing = facts.stealing.includes(base as StealBase)
  const target = isStealing ? stealTargetBaseOf(base) : base
  if (!facts.batterRuns) return target
  const forced = facts.index + 1 > base
  return (forced || facts.outs === 2 || isStealing) && facts.previousTarget >= base ? base + 1 : target
}
