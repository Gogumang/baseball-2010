import type { DefensePlayView } from '@/features/defense-play/model/defensePlayView/viewStateInput'
import { drawDefenseScene } from '@/features/defense-play/model/defenseScene'
import type { RunnerPlayFrame } from '@/features/defense-play/model/runnerPlay/frame/runnerPlayFrame'

/** **5b. 이 그림의 수비 화면 그리기 0x46c88 의 연출 몫** (`defenseScene`) — 관문을 안 보고 그리기마다 돈다(46de4~46e24) */
export function drawSceneEffects(g: RunnerPlayFrame): void {
  const view = g.ticks[g.ticks.length - 1]
  const drawn = drawDefenseScene(g.scene, {
    holderSlot: g.play.ballHolderSlot,
    holder: g.fielders[g.play.ballHolderSlot]?.position,
    holderAction: view?.fielders.find((fielder) => fielder.slot === g.play.ballHolderSlot)?.action,
  })
  g.scene = drawn.scene
  applyDrawnFlags(g, drawn)
  if (view !== undefined) overlayDrawnEffects(g, view, drawn)
}

type SceneDraw = ReturnType<typeof drawDefenseScene>

function applyDrawnFlags(g: RunnerPlayFrame, drawn: SceneDraw): void {
  if (drawn.recordsLaserOut) g.laserOutFlag = true
  // 4412e — 레이저 단계 0: +0x19ad · +0x19ae = 0
  if (drawn.laserStepZero) g.laserFlags = { ...g.laserFlags, shining: false, confirmed: false }
  // 레이저 단계 1 — +0x1993 = 0
  if (drawn.unpaused) g.gamePaused = false
  // 44330 · 44564 — B · C 끝: 플레이+0x1f4 = 0
  if (drawn.flashEnded) g.laserArmed = false
}

/** 줌 · 큰 OUT · 판정 글자 · 번쩍임 — 이 그림에 선 것만 그 그림에 얹는다 */
function overlayDrawnEffects(g: RunnerPlayFrame, view: DefensePlayView, drawn: SceneDraw): void {
  const overlay = {
    ...(drawn.zoom === null ? {} : { zoom: drawn.zoom }),
    ...(drawn.bigOut === null ? {} : { bigOut: drawn.bigOut }),
    ...(drawn.judgeText === null ? {} : { judgeText: drawn.judgeText }),
    ...(drawn.flash === null ? {} : { flash: drawn.flash }),
  }
  if (Object.keys(overlay).length === 0) return
  g.ticks[g.ticks.length - 1] = { ...view, ...overlay }
}
