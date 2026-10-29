import { useRef, useState } from 'react'
import { useSceneTick } from '@/widgets/game-scene/model/useSceneTick'
import { useSceneKeyLatchOwner } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { useCommonWindowPush, useIsCommonWindowOpen } from '@/shared/lib/commonWindow/commonWindow'
import { hiddenNameOf } from '@/entities/collection/model/hiddenOpenNotice'
import { VERSUS_WIN_POPUP_TICK, isVersusMode, versusWinPopupTextOf } from '@/pages/team-game/lib/settlementBoard'
import type { VersusWinReward } from '@/pages/team-game/lib/settlementBoard'

/** 승리 팝업을 띄우는 갱신인가 — 정산 틱 0x14 · 기록 판 열림 · 대전모드(8·9) 승리 · 서버 보상 칸이 있을 때 (4b17a~4b2d4) */
function isVersusWinPopupTick(
  tick: number,
  isPanelOpen: boolean,
  mode: number,
  isWin: boolean,
  reward: VersusWinReward | undefined,
): reward is VersusWinReward {
  return tick === VERSUS_WIN_POPUP_TICK && isPanelOpen && isVersusMode(mode) && isWin && reward !== undefined
}

/**
 * 정산 판의 기록 판 열림 [장면+0x17e8] 과 장면 틱 — 키 처리가 꺼낸 차례대로 고치고 읽는다(`isPanelOpenRef`).
 * 0x4b100 은 [장면+0x17e8](기록 판) && 모드 8·9 일 때 틱 [장면+0x2c] == 0x14 에서 이겼으면 승리 팝업을 공용 창에 띄운다
 * (4b17a~4b2d4). 틱은 들어선 그림이 0 이고, 공용 창이 떠 있는 동안 경기 장면 0x52c50 은 상태 바꿈(틱 +1)을 건너뛴다(52cc6).
 * 키 0x407f0 은 상태 0x19 의 상태 키 함수(52da2~)라 받은 다음 틀의 진입 뒤 · 갱신 앞에서 돈다 — 받은 키는 이 판의 칸(`keyLatch`)에
 * 들고 이 판의 틱 머리에서 꺼낸다(`sceneKeyLatch`)
 */
export function useSettlementPanel(mode: number, isWin: boolean, versusReward: VersusWinReward | undefined) {
  const [isPanelOpen, setPanelOpenState] = useState(false)
  const isPanelOpenRef = useRef(false)
  const setPanelOpen = (isOpen: boolean) => {
    isPanelOpenRef.current = isOpen
    setPanelOpenState(isOpen)
  }
  const pushCommonWindow = useCommonWindowPush()
  const keyLatch = useSceneKeyLatchOwner()
  useSceneTick(
    (tick) => {
      if (!isVersusWinPopupTick(tick, isPanelOpenRef.current, mode, isWin, versusReward)) return
      const text = versusWinPopupTextOf(versusReward, hiddenNameOf)
      if (text !== null) pushCommonWindow(text)
    },
    !useIsCommonWindowOpen(),
    false,
    keyLatch,
  )
  return { isPanelOpen, isPanelOpenRef, setPanelOpen, keyLatch }
}
