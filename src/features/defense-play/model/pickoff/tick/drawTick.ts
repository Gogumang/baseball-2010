import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import { drawSceneEffects } from '@/features/defense-play/model/pickoff/view/sceneEffects'
import { snapshotAt } from '@/features/defense-play/model/pickoff/view/snapshot'

/** 그림 절 */
export function drawPickoffTick(g: PickoffFrame, tick: number): void {
  // 이 판 틱에 낸 소리(차례대로)를 그림에 싣는다 — 미리 돌린 판을 재생만 하는 화면(`DefensePlayback` 의 재생 갈래)이 그 틱에 낸다
  const tickView = snapshotAt(g, tick, g.fielders)
  g.ticks.push(g.sound.thisTick.length > 0 ? { ...tickView, tickSoundIds: [...g.sound.thisTick] } : tickView)
  drawSceneEffects(g)
}
