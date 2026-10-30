import { drawDefenseScene } from '@/features/defense-play/model/defenseScene'
import type { DefensePlayView } from '@/features/defense-play/model/defensePlayView/viewStateInput'
import type { DefensePlayState } from '@/features/defense-play/model/runDefensePlay'

/**
 * **창이 선 첫 그림([창+0x250])의 수비 화면 그리기 0x46c88 — 연출 몫** (r183, 2026-10-25 직접 떴다).
 *
 * 경기 장면 0x52c50 은 공용 창이 서면 52cc6 에서 갱신(진행기 틱 · 목록 틱 0x3f060)을 건너뛰지만, 창이 선 첫 그림은 52efe 를 지나
 * 그리기 표 0xd05a0[0x17 − 9] = 0x46c88 을 한 번 더 돈다. 그 그림의 연출 차례는 갱신이 있는 그림과 같다 — 결과 판 0x46844(46de4) →
 * 레이저 0x4403c(46e08) → 필살 포구 B 0x441c4(46e0e) · C 0x44398(46e14) → 줌 펀치 0xbb84c(46e24) (`defenseScene.drawDefenseScene`).
 * 그래서 판정 글자 0x393b4(3946c) · deadly_effect 애니(44302 · 4452e)가 한 칸 더 가고, 연출 단계 +0x1992 · 결과 판 타이머 +0x108c 도 한 번
 * 더 돈다 — 레이저 단계 1 · B · C 끝의 경기 멈춤 풀기(+0x1993 = 0)가 그 그림에서 나면 **판 진행이 한 갱신 일찍 풀린다**(원본 그대로).
 *
 * 진행기(`stepDefensePlay`)는 그림 N 의 연출을 그 틱 스냅샷에 얹고(`drawSceneEffects`) 상태를 제자리에서 고친다 — 여기도 같은 칸을
 * 같은 식으로 고친다. 그리는 자리는 마지막 그림의 공 가진 야수(플레이 +0x130)다 — 갱신이 없으니 목록 틱(6 절 이동) 앞 자리 그대로다.
 * 돌려준 그림은 마지막 스냅샷에서 연출 칸만 새로 얹은 것이다(진행기 틱 목록에는 안 넣는다 — 갱신이 아니다).
 *
 * ⚠️ 판이 닫힌 뒤(진행기가 끝난 뒤 +0x1094 를 세는 갱신)의 그림은 웹이 연출을 안 돌린다(진행기 밖) — 그 그림의 창 첫 그림도 안 돌린다.
 */
type SceneDraw = ReturnType<typeof drawDefenseScene>

/** 그림이 고친 판 칸을 진행기 상태에 그대로 옮긴다 (진행기 `drawSceneEffects` 와 같은 칸) */
function applyDrawnSceneFlags(state: DefensePlayState, drawn: SceneDraw): void {
  state.scene = drawn.scene
  // 46932 — 큰 OUT 첫 그림이 +0x1999 를 보고 state[0x8b] = 1
  if (drawn.recordsLaserOut) state.laserOutFlag = true
  // 4412e — 레이저 단계 0: +0x19ad · +0x19ae = 0
  if (drawn.laserStepZero) {
    state.laserConfirmed = false
    state.laserShining = false
  }
  if (drawn.unpaused) state.gamePaused = false
  // 44330 · 44564 — B · C 끝: 플레이+0x1f4 = +0x1f8 = +0x1f7 = 0
  if (drawn.flashEnded) {
    state.laserArmed = false
    state.deadlyJumpArmed = false
    state.deadlySlideArmed = false
  }
}

/** 이 그림의 연출 칸 — 갱신이 있는 그림처럼 빈 칸에서 새로 얹는다 */
function viewWithDrawnEffects(view: DefensePlayView, drawn: SceneDraw): DefensePlayView {
  const { zoom: _zoom, bigOut: _bigOut, judgeText: _judgeText, flash: _flash, ...bare } = view
  return {
    ...bare,
    ...(drawn.zoom === null ? {} : { zoom: drawn.zoom }),
    ...(drawn.bigOut === null ? {} : { bigOut: drawn.bigOut }),
    ...(drawn.judgeText === null ? {} : { judgeText: drawn.judgeText }),
    ...(drawn.flash === null ? {} : { flash: drawn.flash }),
  }
}

export function redrawDefensePlayScene(state: DefensePlayState): DefensePlayView | null {
  const view = state.ticks[state.ticks.length - 1]
  if (view === undefined) return null
  const holderSlot = state.play.ballHolderSlot
  const holderView = view.fielders.find((fielder) => fielder.slot === holderSlot)
  const drawn = drawDefenseScene(state.scene, {
    holderSlot,
    holder: holderView === undefined ? undefined : { x: holderView.x, y: holderView.y ?? 0, z: holderView.z },
    holderAction: holderView?.action,
  })
  applyDrawnSceneFlags(state, drawn)
  return viewWithDrawnEffects(view, drawn)
}
