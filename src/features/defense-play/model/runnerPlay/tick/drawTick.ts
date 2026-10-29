import type { DefensePlayView } from '@/features/defense-play/model/defensePlayView/viewStateInput'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'
import { drawSceneEffects } from '@/features/defense-play/model/runnerPlay/view/sceneEffects'
import { snapshotAt } from '@/features/defense-play/model/runnerPlay/view/snapshot'

/** **5 · 5b 절** — 이 판 틱의 그림을 찍고 그리기 0x46c88 의 연출을 얹는다 */
export function drawRunnerPlayTick(g: RunnerPlayFrame, tick: number): void {
  g.ticks.push(withTickSounds(g, snapshotAt(g, tick, g.fielders)))
  drawSceneEffects(g)
}

/**
 * 이 판 틱에 낸 소리(차례대로)를 그림에 싣는다 — 미리 돌린 판을 재생만 하는 화면(`DefensePlayback` 의 재생 갈래)이 그 틱에 낸다.
 * 득점 0xaa0a8 의 자리(`tickRunInSoundAt`)는 그 뒤에 낸 소리(자동 슬라이딩)가 있을 때만 싣는다 — 없으면 함성이 맨 뒤다
 */
function withTickSounds(g: RunnerPlayFrame, tickView: DefensePlayView): DefensePlayView {
  const sounds = g.sound.thisTick
  if (sounds.length === 0) return tickView
  const runInAt = g.sound.runInAt
  const runIn = runInAt !== undefined && runInAt < sounds.length ? { tickRunInSoundAt: runInAt } : {}
  return { ...tickView, tickSoundIds: [...sounds], ...runIn }
}
