import type { PickoffFrame } from '@/features/defense-play/model/pickoff/frame/pickoffFrame'
import { wrapBase } from '@/features/defense-play/model/pickoff/runners/pickoffRunners'

/** 득점 절 */
export function runPickoffScoring(g: PickoffFrame, tick: number): void {
  // ── 득점 0xaa0a8 (슬롯 2 525fc — 플레이 틱 뒤 · vt4c 앞): 내림차순으로 +0x3b(목록 틱에 막 닿음) && +0x8c == 4 인 주자 ──
  // +0x3b 는 그림 N 의 목록 틱(앞 판 틱의 이동)에서만 선다 — 관문 G2 가 닫힌 그림은 0xaa0a8 을 안 부른다(타구 진행기 6f 절)
  for (let index = g.runners.length - 1; index >= 0; index -= 1) {
    const runner = g.runners[index]!
    if (runner.state.isOut || runner.state.scored || runner.counted || !runner.arrivedThisListTick) continue
    const touched = runner.state.startBase
    if (wrapBase(touched) !== 0 || touched === 0) continue
    // ⚠️ 2아웃 득점 보류(state[0])는 타구 진행기 몫이다 — 견제 중 홈인은 자동 진루가 3루 주자를
    // 보낸 경우뿐이라 여기서는 그대로 센다 (근사)
    runner.counted = true
    runner.state = { ...runner.state, scored: true }
    g.runsScored += 1
    g.log.push(`${tick}틱 ${runner.state.index}번 주자 홈인`)
  }
}
