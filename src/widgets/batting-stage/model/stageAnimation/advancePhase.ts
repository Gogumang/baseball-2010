/** 투구 단계 갱신 한 틀 — '대기'(0xf · 0x10) → 0x11 놓기 · 비행 → 0x13 '타격' → 0x12 '결과' */
import { bigHitEndTickOf, bigHitReleaseTickOf } from '@/widgets/batting-stage/lib/bigHitScreen'
import type { PendingHit } from '@/widgets/batting-stage/model/stageRefs'
import type { StageLoop } from '@/widgets/batting-stage/model/stageAnimation/stageLoop'
import { advanceWaiting } from '@/widgets/batting-stage/model/stageAnimation/advanceWaiting'
import { advanceFlight, releasePendingPitch } from '@/widgets/batting-stage/model/stageAnimation/advanceFlight'
import { drawHitStop } from '@/widgets/batting-stage/model/stageAnimation/hitStage'

export function advancePhase(loop: StageLoop, sceneTick: number): void {
  const { phaseEntryRef, phaseRef } = loop.refs
  // 예약한 단계가 아직 안 섰다(예약한 틀) — 옛 상태의 갱신은 이 틀에 이미 돌았다
  if (phaseEntryRef.current !== null) return
  if (phaseRef.current === '대기' && !advanceWaiting(loop, sceneTick)) return
  if (!releasePendingPitch(loop, sceneTick)) return
  if (advanceFlight(loop, sceneTick)) return
  if (phaseRef.current === '타격') {
    advanceHit(loop, sceneTick)
    return
  }
  advanceResult(loop, sceneTick)
}

/** 이번 0x13 칸 — 붙잡은 타구가 바뀌었으면 새로 세운다. 그 0x13 에서 창이 선 첫 그림 자리를 낸다 */
function frozenDrawsOfHit(loop: StageLoop, pending: PendingHit | null): readonly number[] {
  const { phaseStartTickRef, swingStartTickRef } = loop.refs
  if (pending !== null && loop.hitInStage?.pending !== pending) {
    loop.hitInStage = {
      pending,
      startTick: phaseStartTickRef.current,
      endTick: null,
      swingStartTick: swingStartTickRef.current,
      frozenDraws: [],
    }
  }
  return loop.hitInStage !== null && loop.hitInStage.pending === pending ? loop.hitInStage.frozenDraws : []
}

/** 0x406e8 — 큰 타구는 `문턱 ≤ 공 틱` 인 갱신에 끝난다. 공 틱은 막음을 푼 그림 뒤에 오르므로 창 첫 그림이 막음을 당겼으면 끝도 당겨진다 */
function hitEndTickOf(pending: PendingHit | null, frozenDraws: readonly number[]): number {
  if (pending === null) return 0
  return pending.watchesBigHit ? bigHitEndTickOf(pending.ticks, bigHitReleaseTickOf(frozenDraws)) : pending.ticks
}

/** 상태 0x13 — 큰 타구면 낙구할 때까지, 아니면 틱 8 만에 인플레이로 넘어간다 (R10 4절) */
function advanceHit(loop: StageLoop, sceneTick: number): void {
  const { pendingHitRef, phaseStartTickRef, hitSkipKeyTickRef, handlersRef } = loop.refs
  const pending = pendingHitRef.current
  const held = sceneTick - phaseStartTickRef.current
  const frozenDraws = frozenDrawsOfHit(loop, pending)
  const endTick = hitEndTickOf(pending, frozenDraws)
  // 이 틀의 0x13 그리기 0x4cb1c 몫(갱신과 같은 틀 — 0x17 을 예약한 틀도 0x13 을 그린다) — 큰 타구 멈춤이 풀리는 그림
  if (pending !== null) drawHitStop(loop, pending, held, frozenDraws)
  // 건너뛰기 키는 키 다음 틀의 이 갱신(0x406e8 40708)이 읽는다
  const skipKeyTick = hitSkipKeyTickRef.current
  const isSkipped = skipKeyTick !== null && sceneTick >= skipKeyTick
  if (pending !== null && held < endTick && !isSkipped) return
  // 0x13 갱신이 이 틀에 0x17 을 예약한다 — 다음 틀부터 0x13 이 아니다(스윙 멈춤 셈의 끝)
  if (loop.hitInStage !== null && loop.hitInStage.pending === pending) loop.hitInStage.endTick = sceneTick + 1
  handlersRef.current.commitHit(sceneTick)
}

/** 0x12 는 16 그림(볼넷 · 사구 · 삼진 32) — 결과를 세울 때 정한 틱 수(`resultPhaseTicksOf`) */
function advanceResult(loop: StageLoop, sceneTick: number): void {
  const { phaseRef, phaseStartTickRef, resultTicksRef, pitchRef, swingStartTickRef, pitcherStartTickRef } = loop.refs
  if (phaseRef.current !== '결과' || sceneTick - phaseStartTickRef.current < resultTicksRef.current) return
  phaseRef.current = '대기'
  phaseStartTickRef.current = sceneTick
  // 0x12 끝 — 판정 A 가 예약한 다음 상태(0xf · 0xd · 0x17)가 이 틀에 선다. 그 칸은 0x12 를 세울 때 이미 적었다(`BattingStage`
  // 의 `showResult`) — 0xf 면 아래 대기 셈이 0x10 · 0x11 을 이어 적는다
  pitchRef.current = null
  // 0xf 진입 0x3d954 → 0x35650 → 0xb9318 이 스윙 객체를 대기(상태 5)로 되돌린다 — 그때까지 스윙 끝 칸에 머문다 (`batterFrameAt`)
  swingStartTickRef.current = null
  // 같은 0x35650 → 0x340c0 이 투수 그림 객체를 상태 0(선 자세)으로 — 그때까지 투구 마지막 자세에 머문다
  pitcherStartTickRef.current = null
}
