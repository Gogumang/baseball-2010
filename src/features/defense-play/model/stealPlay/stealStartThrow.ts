import { type RunnerState, createRunner } from '@/entities/fielding/model/fieldingState'
import { type StealBase, stealTargetBaseOf } from '@/entities/fielding/model/stealStart'
import type { BaseState } from '@/entities/game/model/baseState'
import type { DefenseScene } from '@/features/defense-play/model/defenseScene'
import { runRunnerPlay } from '@/features/defense-play/model/runnerPlayEngine'
import { DEFAULT_ABILITY, occupiedBasesOf, stealRunnerSpeedOf } from '@/features/defense-play/model/stealPlay/stealStartRunners'
import type { RandomPort } from '@/shared/api/random/randomPort'

export interface StealStartThrowInput {
  /** 앞 판이 남긴 수비 장면 — `playEnd`(앞 판이 끝난 그대로의 플레이 · 야수)가 없으면 아무것도 안 한다 */
  readonly scene: DefenseScene | undefined
  /** 투구 때 루 상황 */
  readonly bases: BaseState
  /** 지금까지 출발한 도루 주자의 루 — 출발한 차례대로(0x583 한 번마다 하나씩 는다). 마지막 것이 이번 키다 */
  readonly stealingFrom: readonly StealBase[]
  /** state[6] — 지금 아웃 수 (0xafb24 가 본다) */
  readonly outs: number
  readonly defenseAbilities?: readonly (number | null)[]
  readonly runAbilities?: Partial<Record<1 | 2 | 3, number>>
  readonly runAbility?: number
  readonly runnerTeamGrade?: number
  readonly random?: RandomPort
}

export interface StealStartThrowResult {
  /** `playEnd` 를 0xafa60 뒤 상태로 바꾼 장면 (던졌으면 +0x128 = 0 · 던진 야수는 공을 놓았다) */
  readonly scene: DefenseScene | undefined
  /** 0xafa60 이 루를 골라 0xb2c90 을 불렀나 */
  readonly decided: boolean
  readonly log: readonly string[]
}

/**
 * **도루 키 0x583 끝의 CPU 송구 결정 0xafa60 한 번** (0x520de 52222 — 직접 뜸, r201).
 * ```
 * 521ea  0xa9bd4(주자관리, 루) — 출발 (`canStartSteal`) ; 루 ≤ 0 이거나 state[0x24](도루 중) == 0 이면 끝
 * 52204  state[0x14 + 루] = state[0x90 + 루] = 1 ; 0x457cc
 * 52222  0xaf8e0(제어기 [장면+0x210]) — 0xaf8b8(state[3]) 뒤 vt0xc = 0xafa60 : 수비 조작이 사람이든 CPU 든 조건 없이 부른다
 * afa60  +0x128 && 공 가진 야수(+0x130) && vtC4(준비) && +0xe0(쥠) && AI ∉ {8, 9} && +0xc8 ≤ 0 → 0xafb24(점수식) → 루 b
 * afad2  b == 0(홈)이면 rand(0, 100) < 20 이면 특수 ; 0xb2c90(b, 특수) 가 참이면 +0x128 = 0 · 0xb0ea0
 * ```
 * 투구 중(상태 0x11)이라 판은 아직 안 열렸다 — 플레이 칸 · 야수는 **앞 판이 끝난 그대로**(`DefenseScene.playEnd`)이고, 주자는 루 위에서
 * 막 출발했다(목표 = 다음 루). 0xb2c90 이 던지면(0xb2e38 — 악송구 굴림 0xa1828 · 흔들림 a198c) 그 공은 다음 판 시작(vt1c · vt20 ·
 * 0xa276c)이 지운다 — 남는 것은 난수 차례와 +0x128 = 0 · 던진 야수가 놓은 공(같은 투구의 다음 도루 키는 더 안 던진다)이다.
 * 진행기는 같은 0xafa60 · 0xb2c90 · 0xb2e38 길을 그대로 쓴다(`RunnerPlayEngineInput.throwDecisionOnly`).
 */
export function stealStartThrowDecision(input: StealStartThrowInput): StealStartThrowResult {
  const carried = input.scene?.playEnd
  if (carried === undefined || !carried.play.wantsThrow) return { scene: input.scene, decided: false, log: [] }
  const abilities = input.defenseAbilities ?? Array.from({ length: 9 }, () => DEFAULT_ABILITY)
  const result = runRunnerPlay({
    kind: carried.play.kind,
    fielders: carried.fielders,
    play: carried.play,
    runners: startedRunnersOf(input),
    abilities,
    outs: input.outs,
    ballOnGround: true,
    random: input.random,
    // 0xafa60 은 제어기 vt0xc 를 곧바로 부른다 — 수비 CPU · 송구 설정을 안 본다
    defenseIsCpu: true,
    manualThrowBase: carried.play.manualThrowBase,
    throwDecisionOnly: true,
  })
  const after = result.scene.playEnd
  return {
    scene: input.scene === undefined || after === undefined ? input.scene : { ...input.scene, playEnd: after },
    decided: result.log.length > 0,
    log: result.log.map((line) => `도루 키 0x583 · ${line}`),
  }
}

/** 0xa9bd4 → vt48(0xb6228) — 출발한 주자의 목표 루는 한 루 앞. 리드(0x3d7b8)는 판이 열릴 때라 아직 루 위다 */
function startedRunnersOf(input: StealStartThrowInput): RunnerState[] {
  const runners: RunnerState[] = []
  for (const base of occupiedBasesOf(input.bases)) {
    const runner = createRunner(runners.length + 1, base, stealRunnerSpeedOf(input, base), { isBatterRunner: false })
    runners.push(input.stealingFrom.includes(base) ? { ...runner, targetBase: stealTargetBaseOf(base) } : runner)
  }
  return runners
}
