/**
 * 이 공의 원본 상태 경계(0x11 · 0x12 · 그 끝, 맞은 공은 0x11 · 0x13 · 0x17) — 장면 틱(팝업으로 뺀 틱을 되돌린 값)으로 적는다
 * (`sceneStateEntries`). 판정 · 0x12 문턱은 공보다 한 그림 늦게 들 수 있다 · 0x13 은 건너뛰기 키로 짧아진다 — 바뀔 때만 다시 적는다
 */
import { markSceneStateEntries } from '@/shared/lib/commonWindow/sceneStateEntries'
import { hitEndTickOf, pitcherSideStateEntriesOf } from '@/widgets/batting-stage/lib/pitcherSideStage'
import type { PitcherSideLoop } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideLoop'
import type { PitcherSideFrame } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideFrame'

export function markPitchStateEntries(loop: PitcherSideLoop, frame: PitcherSideFrame): void {
  const { pitch, hit } = frame
  const releaseTick = loop.releaseTick
  if (releaseTick === null || pitch === null || frame.stage.phase.kind === '대기') return
  const sceneReleaseTick = releaseTick + (frame.sceneTick - frame.nowTick)
  const marked = `${sceneReleaseTick}-${frame.heldResultTicks}-${hit === null ? '' : hitEndTickOf(hit)}`
  if (marked === loop.markedStateEntries) return
  loop.markedStateEntries = marked
  markSceneStateEntries(...pitcherSideStateEntriesOf(sceneReleaseTick, pitch.frameCount, frame.heldResultTicks, frame.aceOrder, hit))
}
