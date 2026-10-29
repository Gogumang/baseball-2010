/** 갱신(`advancePhase`)이 끝난 뒤 이 틀이 읽는 타석 칸 — 파티클 틱 앞에 읽어 그림 입력(`stageSceneNow`)에 넘긴다 */
import type { Pitch } from '@/entities/pitching/model/pitch'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { bodyTypeOf } from '@/widgets/batting-stage/lib/batterLayers'
import { ballFrameOf, type PendingHit } from '@/widgets/batting-stage/model/stageRefs'
import type { StageLoop } from '@/widgets/batting-stage/model/stageAnimation/stageLoop'
import { batterSideNow } from '@/widgets/batting-stage/model/stageAnimation/batterSide'

export interface StageFrameReads {
  /** 이 틀의 장면 틱 — 갱신 · 그리기가 모두 이 틱 하나로 센다 */
  readonly sceneTick: number
  /** 이 틱의 머리 시각 — 부르는 쪽이 장면 시계(ms)로 넘긴 창(`homeRunText`)을 같은 격자에서 읽는다 */
  readonly tickTime: number
  readonly tickLength: number
  readonly isBackdrop: boolean
  readonly pitch: Pitch | null
  /** 몸통 종류 t = 폼 >> 1 (0 balancer · 1 sluger, 0x78ab0) — 자세표도 이걸로 갈린다 */
  readonly bodyType: number
  readonly side: number
  readonly isPitching: boolean
  readonly ballFrame: number
  readonly pitcherStartTick: number | null
  readonly pendingHit: PendingHit | null
  /** 홈런 연출은 결과 문구 시간(1150ms)보다 길다 — 날아 들어오기만 22틱이라 따로 센다 */
  readonly homeRunStartTick: number | null
  /** 글자는 결과 단계가 선 틀부터다 — 예약한 틀은 아직 0x11 · 0x13 그림이다 */
  readonly isHomeRun: boolean
}

export function stageFrameReadsOf(
  loop: StageLoop,
  frame: { readonly sceneTick: number; readonly tickTime: number; readonly isBackdrop: boolean },
): StageFrameReads {
  const { pitchRef, phaseRef, phaseStartTickRef, latestRef, pitcherStartTickRef, pendingHitRef, homeRunStartTickRef } = loop.refs
  const { sceneTick } = frame
  const pitch = pitchRef.current
  const tickLength = millisecondsPerFrame()
  const bodyType = bodyTypeOf(latestRef.current.batterForm)
  const side = batterSideNow(loop)
  const isPitching = phaseRef.current === '투구중' && pitch !== null
  const ballFrame = isPitching ? ballFrameOf(sceneTick - phaseStartTickRef.current, latestRef.current.acePitcher?.order) : -1
  const homeRunStartTick = homeRunStartTickRef.current
  return {
    ...frame,
    tickLength,
    pitch,
    bodyType,
    side,
    isPitching,
    ballFrame,
    pitcherStartTick: pitcherStartTickRef.current,
    pendingHit: phaseRef.current === '타격' ? pendingHitRef.current : null,
    homeRunStartTick,
    isHomeRun: homeRunStartTick !== null && sceneTick >= homeRunStartTick,
  }
}
