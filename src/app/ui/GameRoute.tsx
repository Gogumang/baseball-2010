import { RecordAlertStageOverlay } from '@/widgets/game-scene/ui/RecordAlertPanel'
import { BURST_RESULT_STATE_TICK } from '@/widgets/game-scene/model/useRecordAlert'
import type { GameRouteProps } from '@/app/ui/gameRoute/gameRouteProps'
import { useGameRouteState } from '@/app/ui/gameRoute/useGameRouteState'
import { defensePlayScreenOf, introScreenOf, loadingScreenOf } from '@/app/ui/gameRoute/gameRouteScreens'
import { relayScreenOf } from '@/app/ui/gameRoute/relayScreen'
import { batterScreenOf, burstWindowOf } from '@/app/ui/gameRoute/batterScreen'

/** 타석 위 돌발 결과 창 0x1d 가 서 있으면 그 그리기 0x4d1e0 이 박는 상태 틱 — 판 위 창 0x1c · 제안 창 0x1b 는 안 박는다 */
function burstResultTickOf(isOverBatter: boolean, hasBurstWindow: boolean, hasResolution: boolean): number | null {
  return isOverBatter && hasBurstWindow && hasResolution ? BURST_RESULT_STATE_TICK : null
}

/**
 * 나만의리그 경기 — 원작 로딩 화면(StrTIP)이 끝나면 타석으로.
 *
 * 인플레이 타구가 나오면 **수비 화면을 먼저 보여 준다**. 원본은 타구가 뜬 순간 경기 장면이
 * 상태 0x17(수비 인플레이)로 넘어가 공이 멈출 때까지 같은 루프를 돌며 **매 갱신 눌린 키를 읽는다**
 * (R10 · I 문서). 웹도 이제 같은 모양이다 — 진행기를 여기서 **실시간으로 한 틱씩** 돌리고
 * (`input` 갈래), 사람은 모드 4 에서 늘 공격이라 `side="공격"`(진루·귀루·슬라이딩)을 잡는다.
 * 다 돌면 `onDone` 이 그 결과를 경기 상태에 먹인다 — **주자 처리는 그때 처음 정해진다.**
 * 홈런 비행처럼 조작할 것이 없는 장면만 예전대로 `ticks` 재생 갈래로 간다.
 *
 * 돌발미션이 발동하면 **타석 화면 위에** 창을 얹는다 (원본 상태 0x1b, K 4절 1-6).
 * 창이 떠 있는 동안 타석을 멈춰 둔다 — 원본도 장면 상태가 0xf 를 떠나 있어 투구가 나가지 않는다.
 */
export function GameRoute(props: GameRouteProps) {
  const view = useGameRouteState(props)
  const { session, defenseUnderBurst, resolution, recordAlert, burstResultTickRef, sceneBuntKindRef } = view
  if (session.loadingTip !== null) return loadingScreenOf(view, session.loadingTip)
  if (!view.isIntroDone) return introScreenOf(view)
  const burstWindow = burstWindowOf(view)
  const defensePlayScreen = defensePlayScreenOf(view)
  if (defensePlayScreen !== null) return defensePlayScreen
  // 상태 0x1c — 판 끝(0x528b0)에서 난 돌발 판정의 창은 방금 판의 수비 화면 위에 선다(0x46ee0 → 0x46c88). 그 위 기록 달성 알림 0x4e35c 는
  // 0x17 이 아니라 그린다(53064)
  const heldDefense = defenseUnderBurst.held(
    <>
      {burstWindow.element}
      <RecordAlertStageOverlay frame={recordAlert} />
    </>,
  )
  // 0x1c(판 위 창 0x46ee0)는 상태 틱을 안 박고, 타석 위 결과 창 0x1d(0x4d1e0)만 박는다
  // oxlint-disable-next-line react/refs -- 0x1d 그리기 0x4d1e0 이 상태 틱을 박는 칸: 이 갈래까지 온 그림만 적는다(앞 갈래로 나간 그림은 지난 값 그대로 — 그동안 알림 틱은 서 있다)
  burstResultTickRef.current = burstResultTickOf(heldDefense === null, burstWindow.element !== null, resolution !== null)
  if (heldDefense !== null) return heldDefense
  const relayScreen = relayScreenOf(view)
  if (relayScreen !== null) return relayScreen
  // oxlint-disable-next-line react/refs -- 장면 +0xfdc 를 이 그림의 값으로 넘긴다 — 타석 화면은 넘겨받은 값이 바뀐 그림에서만 따라간다(키가 고친 값을 덮는 때가 옛 꼴 그대로)
  const sceneBuntKind = sceneBuntKindRef.current
  return batterScreenOf(view, burstWindow, sceneBuntKind)
}
