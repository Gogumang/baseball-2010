import { isReadyToThrow } from '@/entities/fielding/model/fielderPose'
import { NONE } from '@/entities/fielding/model/fieldingState'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'

/**
 * **공 가진 야수가 던질 준비가 됐나** — 0xafa60 · b4674 가 보는 `야수.vtC4()` = 0xa20ec
 * (`+0xb0 == 0 && +0xb4 ≤ 0 && +0xc8 ≤ 0`) 와 0xafa60 의 `AI 상태 ∉ {8, 9}`.
 * 쥐기 0xb2710(P, f, 1)이 +0xc8 에 준비 틱(내야 3 · 외야 6)을 넣고, 이 틱 머리(0절)의 야수 틱이 쥔 동안 하나씩 줄인다.
 * 상태 8(협살)은 CPU 수비에만 선다. 자세 워드 +0xb0 · 잠금 +0xb4 도 본다(`fielderPose.isReadyToThrow`, r171) — 포구 동작이
 * 세운 워드가 야수 틱에서 지워질 때까지 기다린다.
 */
export function isHolderReady(s: DefensePlayState): boolean {
  const holder = s.fielders[s.play.ballHolderSlot]
  return s.play.held && holder !== undefined && holder.holdingBall && isReadyToThrow(holder) && s.rundown.runnerIndex === NONE
}
