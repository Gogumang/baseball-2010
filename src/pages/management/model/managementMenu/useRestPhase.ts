import { useState } from 'react'

/**
 * 127 휴식 — 'playing' 은 연출(0x85230 · 그리기 0x19e08), 'result' 는 연출 뒤 결과 창(0x18e3c)이 떠 있는 동안이다.
 * 127 은 가운데 판 0x7f814 를 빼는 상태라(0x19da4 의 19dc0~19dd4) 두 때 모두 가운데 판을 그리지 않는다. 결과 창이 닫히면
 * 0x1b466 이 105 로 — 그때 걷는다. 회복 알림은 105 위에 뜬다: 창 콜백 0x1b308 이 창을 닫고(0x742a9) 굴린 뒤
 * 알림 0xbbef9 를 띄우고(1b45c) 0xbcb49(0x69) 를 예약하면(1b466), 다음 틀 머리 0x1cdec 의 0xbc9c9 가 창과 상관없이 105 를
 * 세운다(창 게이트 0x754f9 는 1d070 에서 키만 막는다) — 알림이 떠 있는 동안 가운데 판이 보이는 것이 원본이다.
 * 결과 창이 닫힌 렌더에서 곧바로 걷는다(훈련 결과와 같은 까닭) — 105 에 다시 들어 칸을 다시 펼친다(`onReentered`).
 */
export function useRestPhase(hasDetail: boolean, onReentered: () => void) {
  const [restPhase, setRestPhase] = useState<'playing' | 'result' | null>(null)
  if (restPhase === 'result' && !hasDetail) {
    setRestPhase(null)
    onReentered()
  }
  return { restPhase, setRestPhase }
}
