import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { drawDefenseScene } from '@/features/defense-play/model/defenseScene'

// ── 5b. 수비 화면 그리기 0x46c88 의 연출 몫 — 결과 판 0x46844(46de4) → 레이저 0x4403c(46e08) → 필살 포구 B 0x441c4(46e0e) ·
//       C 0x44398(46e14) → 줌 펀치 0xbb84c(46e24). 셋은 연출 단계 +0x1992 를 함께 쓴다 (`defenseScene`) ──
// 그림 N 의 그리기라 다음 그림의 목록 틱(6 절 이동) 앞 자리 — 공 가진 야수 자리도 이 그림의 자리다(예전 웹은 이동 뒤 자리를 봤다).
// 원본은 그리기마다 돈다(판 진행 관문을 안 본다 — 46de4~46e24 앞에 관문 갈래가 없다). 그래서 G2 만 닫힌 그림(10 절)도 한 번 더 부른다.
/** 마지막 스냅샷 그림에 이 그림의 연출을 한 번 돌려 얹는다 */
export function drawSceneEffects(s: DefensePlayState): void {
  const holderView = s.ticks[s.ticks.length - 1]?.fielders.find((fielder) => fielder.slot === s.play.ballHolderSlot)
  const drawn = drawDefenseScene(s.scene, {
    holderSlot: s.play.ballHolderSlot,
    holder: s.fielders[s.play.ballHolderSlot]?.position,
    holderAction: holderView?.action,
  })
  s.scene = drawn.scene
  applyDrawnFlags(s, drawn)
  overlayDrawnEffects(s, drawn)
}

type SceneDraw = ReturnType<typeof drawDefenseScene>

function applyDrawnFlags(s: DefensePlayState, drawn: SceneDraw): void {
  // 46932 — 큰 OUT 첫 그림이 +0x1999 를 보고 state[0x8b] = 1
  if (drawn.recordsLaserOut) s.laserOutFlag = true
  // 4412e — 레이저 단계 0: +0x19ad · +0x19ae = 0
  if (drawn.laserStepZero) {
    s.laserConfirmed = false
    s.laserShining = false
  }
  if (drawn.unpaused) s.gamePaused = false
  // 44330 · 44564 — B · C 끝: 플레이+0x1f4 = +0x1f8 = +0x1f7 = 0
  if (drawn.flashEnded) {
    s.laserArmed = false
    s.deadlyJumpArmed = false
    s.deadlySlideArmed = false
  }
}

/** 줌 · 큰 OUT · 판정 글자 · 번쩍임 — 이 그림에 선 것만 마지막 그림에 얹는다 */
function overlayDrawnEffects(s: DefensePlayState, drawn: SceneDraw): void {
  const view = s.ticks[s.ticks.length - 1]
  const overlay = {
    ...(drawn.zoom === null ? {} : { zoom: drawn.zoom }),
    ...(drawn.bigOut === null ? {} : { bigOut: drawn.bigOut }),
    ...(drawn.judgeText === null ? {} : { judgeText: drawn.judgeText }),
    ...(drawn.flash === null ? {} : { flash: drawn.flash }),
  }
  if (view === undefined || Object.keys(overlay).length === 0) return
  s.ticks[s.ticks.length - 1] = { ...view, ...overlay }
}
