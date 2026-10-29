import { listTickFielder } from '@/entities/fielding/model/fielderPose'
import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import { tickMarkCounter } from '@/features/defense-play/model/playerEffects'

/** 틱 머리 */
export function beginPickoffTick(g: PickoffFrame): void {
  g.sound.slidingThisTick = false
  g.sound.thisTick = []
  g.outJudgedThisTick = false
  g.tickMessageCode = 0
  g.pausedAtHead = g.gamePaused
  g.pausedThisTick = false
  // ── 야수 틱 0xa1284 — 공 쥔 야수의 준비 틱 +0xc8 −= 1 (공용 갱신 0x3f060 이 슬롯 2 보다 먼저, 타구 진행기 0' 절) ──
  // 경기 멈춤(+0x1993)이 머리에서 서 있으면 0x3f060 이 3f0a4 에서 돌아가 목록 틱이 없다
  if (!g.pausedAtHead) {
    // a12da · a12e6 — 동작 잠금(+0xb4)이 없는 틱에만 +0xb8 · +0xc0 을 −1 (그림의 "!" 만 본다)
    g.fumbleMarks = g.fumbleMarks.map((value, slot) => tickMarkCounter(value, (g.fielders[slot]?.actionLockTicks ?? 0) > 0))
    g.throwErrorMarks = g.throwErrorMarks.map((value, slot) => tickMarkCounter(value, (g.fielders[slot]?.actionLockTicks ?? 0) > 0))
    // a1286 프레임 +1 · 잠금 · 준비 틱 · 자세 워드 지우기 a137a~a1456(vt10 — 목표 = 위치) (`fielderPose.listTickFielder`, r176)
    g.fielders = g.fielders.map(listTickFielder)
  }
  g.ballEventThisTick = false
}
