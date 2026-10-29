import { requiredBasePinOf } from '@/entities/fielding/model/autoAdvance'
import { basePosition, stepToward } from '@/entities/fielding/model/fieldGeometry'
import { NONE } from '@/entities/fielding/model/fieldingState'
import { isAtTarget, startLeg } from '@/features/defense-play/model/defensePlay/runners/mutableRunner'
import type { MutableRunner } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

/**
 * 주자 틱 0xa01cc 한 번. 주자+0x3b — a0364 0xbf094 가 머리(bf0a2)에서 지우고, 목표점에 없을 때만 부르는 이동 0xbf0dc 가
 * 막 닿은 갱신에서만 1 로 세운다. 다음 판 틱의 득점 0xaa0a8(6f 절)이 본다
 */
export function stepRunnerOnListTick(runner: MutableRunner): void {
  runner.arrivedThisListTick = false
  if (runner.state.isOut || runner.state.scored) return
  pinToRequiredBase(runner)
  const wasAtTarget = isAtTarget(runner.state)
  runner.state = { ...runner.state, position: stepToward(runner.state.position, basePosition(runner.state.targetBase), runner.state.speed) }
  if (!isAtTarget(runner.state)) return
  if (!wasAtTarget) runner.arrivedThisListTick = true
  settleOnBase(runner)
  // 포스로 밀린 루까지는 반드시 간다 (포스 사슬의 최소 루). 한 루씩 이어 달린다
  if (runner.state.targetBase < runner.minimumBase) startLeg(runner, runner.state.targetBase + 1)
}

/**
 * 주자 틱 0xa01cc 의 요구 루 갈래 a028c (`requiredBasePinOf`) — 자동 진루(4절)가 리터치 주자를 다음 루로 보내도
 * 요구 루에 닿아 풀리기(0xa040c) 전에는 되돌려 세운다. 판 진행 관문 0xb0d28 의 0xaa05c 가 +0x94 를 보므로
 * 이것이 없으면 요구 루를 못 푼 주자가 판을 끝없이 잡아 둔다.
 */
function pinToRequiredBase(runner: MutableRunner): void {
  const pinned = requiredBasePinOf(runner.state)
  if (pinned === runner.state.targetBase) return
  runner.state = { ...runner.state, legStart: runner.state.position, targetBase: pinned, settled: false }
}

/**
 * 0xa040c 도착 — **+0x8c = +0x7c**(닿은 루를 "마지막으로 닿은 루" 로 굳힌다).
 * 그 뒤 `+0x94 && +0x8c == +0x88` 이면 `+0x88 = -1, +0x94 = 0` 으로 요구 루가 풀린다. +0x84 = +0x8c = +0x7c 로 적는다
 */
function settleOnBase(runner: MutableRunner): void {
  const touched = runner.state.targetBase
  const required = runner.state.requiredBase
  runner.state = { ...runner.state, settled: true, startBase: touched, requiredBase: required !== NONE && required === touched ? NONE : required }
  runner.previousTarget = touched
}
