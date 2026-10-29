/** 틀 머리에서 props 를 지켜본다 — 팝업으로 멈춘 틱 · 놓은 공 · 늦게 든 맞은 장면 · 0xd 진입 · 쉬기 */
import { rememberSceneBallPath } from '@/widgets/batting-stage/model/sceneBallPath'
import type { PitcherHitScene } from '@/widgets/batting-stage/lib/pitcherSideStage'
import { pitchMarksOf, type PitcherSideLoop } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideLoop'
import type { PitcherSideStageProps } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideProps'
import { emitWindUpMagicUpTo } from '@/widgets/batting-stage/model/pitcherSideLoop/windUpMagic'

/** 팝업(`isFrozen`) 동안 멈춘 틱을 센다 — 그것을 뺀 장면 틱(이 장면의 시계)을 돌려준다 */
export function advanceFrozenTicks(loop: PitcherSideLoop, current: PitcherSideStageProps, sceneTick: number): number {
  if (current.isFrozen === true) {
    loop.frozenSinceTick ??= sceneTick
  } else if (loop.frozenSinceTick !== null) {
    loop.frozenTicks += sceneTick - loop.frozenSinceTick
    loop.frozenSinceTick = null
  }
  return (loop.frozenSinceTick ?? sceneTick) - loop.frozenTicks
}

/** 새 공의 맞은 장면 — 공이 없으면 없다 */
function releasedHitOf(current: PitcherSideStageProps): PitcherHitScene | null {
  return current.pitch === null ? null : (current.hitScene ?? null)
}

/** 놓은 공(0x11 틱 10)이 들었으면 그 공의 칸을 새로 둔다 */
export function applyReleasedPitch(loop: PitcherSideLoop, current: PitcherSideStageProps, nowTick: number): void {
  if (current.pitch === loop.shownPitch) return
  // 이 그림 전에 못 센 와인드업 그림(틱 ≤ 9)을 앞 공 경로로 마저 쏘고 비운다
  if (loop.windUpMagic !== null) {
    emitWindUpMagicUpTo(loop, loop.windUpMagic.stateTickRef.current)
    loop.windUpMagic = null
  }
  loop.shownPitch = current.pitch
  loop.releaseTick = current.pitch === null ? null : nowTick
  // 놓기 0x4dc78 이 경로 칸 [경기+0x1140] 을 채운다 — 다음 공의 놓기 전 그림이 본다(`sceneBallPath`)
  rememberSceneBallPath(current.pitch)
  loop.shownSwing = current.cpuSwing ?? null
  loop.shownMistake = current.pitch !== null && current.isMistakePitch === true
  // 0x11 진입 3de7c — 상태 1 이 대기 동작을 덮는다
  loop.idleStartTick = null
  loop.marks = pitchMarksOf(releasedHitOf(current))
  loop.hitKeyLatch.clear()
}

/** 맞은 장면 재료가 공보다 늦게 들면 그때 받는다 · 이 장면이 날리지 않은 공의 0x13 은 곧장 넘긴다 */
export function applyHitSceneProps(loop: PitcherSideLoop, current: PitcherSideStageProps): void {
  const hitScene = current.hitScene ?? null
  if (hitScene === null) return
  if (loop.releaseTick !== null && loop.marks.hit === null) loop.marks.hit = hitScene
  if (loop.releaseTick !== null || loop.marks.endNotified) return
  // 화면이 설 때 이미 있던 공 — 다시 그리지 않고 곧장 넘긴다
  loop.marks.endNotified = true
  current.onHitSceneEnd?.()
}

/** 0xd 진입 · 쉬기 시작 */
export function applySceneEntryProps(loop: PitcherSideLoop, current: PitcherSideStageProps, nowTick: number): void {
  // 0xd 진입 0x48d50 48ee4 → 0x35650 → 0x340c0 — 투수 그림 객체를 상태 0 으로 (굳은 대기 동작도 지운다)
  if (current.sceneDEntryMark !== loop.seenSceneDEntryMark) {
    loop.seenSceneDEntryMark = current.sceneDEntryMark
    loop.idleStartTick = null
    loop.idleEndTick = null
  }
  if (current.isPaused && !loop.wasPaused) loop.pausedSinceTick = nowTick
  loop.wasPaused = current.isPaused
}
