import { applyControlKeys } from '@/features/defense-play/model/defensePlay/controls/controlKeys'
import { runPlayGatePhase } from '@/features/defense-play/model/defensePlay/gate/playGatePhase'
import { fireLaserIfReady, rollLaserWindow } from '@/features/defense-play/model/defensePlay/laser/laserPhase'
import { listTickHead } from '@/features/defense-play/model/defensePlay/listTick/listTickHead'
import { listTickMove } from '@/features/defense-play/model/defensePlay/listTick/listTickMove'
import { pressFastForwardKey } from '@/features/defense-play/model/defensePlay/step/fastForward'
import { isDefensePlayFinished } from '@/features/defense-play/model/defensePlay/step/playFinished'
import { runSlot2 } from '@/features/defense-play/model/defensePlay/step/slot2'
import { type TickFrame, closeTickFrame, openTickFrame } from '@/features/defense-play/model/defensePlay/step/tickFrame'
import type { DefenseKeyPress } from '@/features/defense-play/model/defensePlay/types/defenseKeyPress'
import type { DefensePlayState } from '@/features/defense-play/model/defensePlay/types/defensePlayState'
import { drawSceneEffects } from '@/features/defense-play/model/defensePlay/view/sceneEffects'
import { snapshotAt } from '@/features/defense-play/model/defensePlay/view/snapshot'

/**
 * **한 판 틱 = 한 갱신(0xc2198)** — 경기 장면 그림 하나의 차례 그대로 돈다:
 * 키 처리(건너뛰기 0x519cc · 사람 조작 0x53420) → 그림 머리 0x3f060(목록 틱의 야수 몫 · 카메라) → 레이저 창 · 발사 →
 * 슬롯 2 0x524c0(플레이 틱 · 득점 · 야수 AI · 자동 진루 · CPU 송구) → 그리기 0x46c88(스냅샷 · 연출) → 다음 그림의 목록 틱(이동) →
 * 판 진행 관문 0xb0d28.
 * 판 상태(`DefensePlayState`)는 각 절이 그 자리에서 고치고, 이 틱에만 사는 칸은 `TickFrame` 이 든다.
 */
export function stepDefensePlay(state: DefensePlayState, key: DefenseKeyPress | null = null): DefensePlayState {
  if (isDefensePlayFinished(state)) return state
  const t = openTickFrame(state, key)
  pressFastForwardKey(state, t)
  // 경기 멈춤(+0x1993)이 머리에서 서 있으면 0x3f060 이 3f0a4 에서 돌아가 목록 틱(야수 · 주자)이 없다
  if (!t.pausedAtHead) listTickHead(state)
  applyControlKeys(state, t)
  rollLaserWindow(state, t)
  fireLaserIfReady(state, t)
  // 멈춘 그림은 슬롯 2(포구 · 송구 · 협살 · 자동 진루 · CPU 송구)가 없다 — 그림(5 절)은 그대로 남긴다
  if (!state.gamePaused) runSlot2(state, t)
  drawTick(state, t)
  // 관문 G3 · G4 · G1 은 다음 그림의 목록 틱(6 절 이동) 앞 주자를 본다 (`playGate.gateRunnerViewsOf`)
  const runnersBeforeListTick = state.runners.map((runner) => runner.state)
  // 6~7 절은 다음 그림의 목록 틱(0x3f060)과 플레이 틱 꼬리다 — 이 틱에 멈췄으면 다음 그림도 멈춰 있어 없다
  if (!t.pausedThisTick) listTickMove(state, t)
  runPlayGatePhase(state, t, runnersBeforeListTick)
  closeTickFrame(state, t)
  return state
}

/** 5 · 5b 절 — 이 그림의 스냅샷을 찍고 그리기 0x46c88 의 연출을 얹는다 */
function drawTick(s: DefensePlayState, t: TickFrame): void {
  s.ticks.push(snapshotAt(s, t, t.tick, s.fielders, t.pausedAtHead))
  drawSceneEffects(s)
}
