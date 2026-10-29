/** 타자 곁 그림 · 상태 갈래의 이 그림 재료 — 필살 스윙 그림 · 타격 불꽃 · 사구 표시 · 0x4c4bc 상태 갈래 */
import { SCENE_STATE, sceneStateEntryAt } from '@/shared/lib/commonWindow/sceneStateEntries'
import { hitByPitchMarkDrawCallOf } from '@/widgets/batting-stage/lib/batterOverlayMarks'
import type { StagePhaseSnapshot } from '@/widgets/batting-stage/lib/softKeyLabels'
import type { StageLoop } from '@/widgets/batting-stage/model/stageAnimation/stageLoop'

/**
 * 필살 그림 · 보통 타격 불꽃의 부름 차례 — 맞은 틀 J(0x11 — 0x13 을 예약한 틀)의 그림이 첫 부름이다: 0x3f060 끝(3f320)이 스윙 객체를 틀
 * 머리에 한 칸 넘기고 갱신 0x4e060 이 0xb9270 == 0(상태 3 · 프레임 1)에서 판정했으니 같은 틀 그리기 0x49e64 49f8c 도 0xb9271 == 0 ·
 * +0xfd2 를 본다. 0x13 은 그림마다(49f7c 상태 == 0x13) — 틱 d 의 그림이 d + 2 번째 부름. 그리지 않는 그림이면 null
 */
function contactDrawCallOf(loop: StageLoop, sceneTick: number): number | null {
  const { phaseRef, phaseEntryRef, phaseStartTickRef } = loop.refs
  if (phaseRef.current === '투구중' && phaseEntryRef.current?.phase === '타격') return 1
  if (phaseRef.current !== '타격') return null
  return sceneTick - phaseStartTickRef.current + 2
}

/** 필살 스윙 연출 그림 0x49aec — 맞은 틀(0x11)에 처음, 이어 상태 0x13('타격') 그림마다 (k = 단계 틱 + 2, `specialSwingEffect`) */
export function specialSwingEffectNow(loop: StageLoop, sceneTick: number) {
  const effect = loop.refs.pendingHitRef.current?.specialEffect ?? null
  if (effect === null) return null
  const drawCall = contactDrawCallOf(loop, sceneTick)
  return drawCall === null ? null : { ...effect, drawCall }
}

/** 보통 타격 불꽃 0x49e64 49faa~4a0a2 — 필살 그림과 같은 부름 차례(`batterOverlayMarks`) */
export function hitFlameNow(loop: StageLoop, sceneTick: number) {
  const flame = loop.refs.pendingHitRef.current?.hitFlame ?? null
  if (flame === null) return null
  const drawCall = contactDrawCallOf(loop, sceneTick)
  return drawCall === null ? null : { ...flame, drawCall }
}

/** 사구 표시 0x49e64 4a0ce — 사구 0x12 의 틱 0~7 그림 (`batterOverlayMarks`) */
export function hitByPitchMarkNow(loop: StageLoop, sceneTick: number): number | null {
  const { phaseRef, isInPlayResultRef, isHitByPitchResultRef, phaseStartTickRef } = loop.refs
  if (phaseRef.current !== '결과' || isInPlayResultRef.current || !isHitByPitchResultRef.current) return null
  return hitByPitchMarkDrawCallOf(sceneTick - phaseStartTickRef.current)
}

/**
 * 0x4c4bc 의 상태 갈래 재료 — 쉬는 '대기' 면 확인 대기가 적은 상태 경계(`sceneStateEntries`)로 0xd · 0xe 를 가르고 틱은 0xe 진입부터
 * 센다(0xe 진입 0x50674 가 필살 판 애니를 되감는다). 경계가 없으면 쉬기 시작한 뒤 틱. 쉬기 시작 틱(`pausedSince`)을 여기서 적는다
 */
export function stagePhaseNow(loop: StageLoop, sceneTick: number): StagePhaseSnapshot {
  const { phaseRef, isInPlayResultRef } = loop.refs
  const isPaused = isPausedPictureAt(loop, sceneTick)
  const pausedWaiting = phaseRef.current === '대기' && isPaused
  trackPausedSince(loop, pausedWaiting, sceneTick)
  const entry = pausedWaiting ? sceneStateEntryAt(sceneTick) : null
  return {
    kind: phaseRef.current,
    tick: sceneTick - phaseTickOriginOf(loop, entry),
    isPaused,
    isInPlay: phaseRef.current === '결과' && isInPlayResultRef.current,
    // 쉬는 동안 0xd(타석 준비 두 그림)인가
    isSceneD: entry?.state === SCENE_STATE.준비,
  }
}

/** 쉬기가 풀렸어도 0xf 가 서기 전 틀(`advancePhase`)은 쉬던 그림 그대로다 */
function isPausedPictureAt(loop: StageLoop, sceneTick: number): boolean {
  const { latestRef, phaseRef, phaseStartTickRef } = loop.refs
  return latestRef.current.isPaused || (phaseRef.current === '대기' && sceneTick < phaseStartTickRef.current)
}

/** 쉬는 '대기' 에 든 장면 틱을 적고, 쉬지 않으면 지운다 */
function trackPausedSince(loop: StageLoop, pausedWaiting: boolean, sceneTick: number): void {
  if (!pausedWaiting) loop.pausedSince = null
  else if (loop.pausedSince === null) loop.pausedSince = sceneTick
}

/** 단계 틱을 세는 시작 — 0xe 진입(확인 대기 경계) · 쉬기 시작 · 단계 시작 차례 */
function phaseTickOriginOf(loop: StageLoop, entry: ReturnType<typeof sceneStateEntryAt> | null): number {
  const confirmEntryTick = entry?.state === SCENE_STATE.확인 ? entry.tick : null
  return confirmEntryTick ?? loop.pausedSince ?? loop.refs.phaseStartTickRef.current
}
