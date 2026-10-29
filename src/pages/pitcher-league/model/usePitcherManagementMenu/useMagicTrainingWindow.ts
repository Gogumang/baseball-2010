import { useCallback, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  PITCHER_TRAINING_MENUS,
  magicTrainingCellBlockOf,
  magicTrainingCellCostOf,
  magicTrainingCursorOf,
} from '@/entities/pitcher-career/model/pitcherManagement'
import type { PitcherTrainingMenu } from '@/entities/pitcher-career/model/pitcherManagement'
import type { PitcherMenuQuestion, PitcherMenuWindow } from './menuTypes'
import { magicCellBlockNoticeOf, modeTextOf } from './menuText'

/**
 * 108 마구 창(탭 1) — 격자 커서(창 객체 +0xc · +0x10)와 확인 키 **0x17828**.
 *
 * 0x17828 은 탭 0(타자 필살타법)과 같은 갈래 17858~17a42 다 (`magicTrainingCellBlockOf`).
 * 팝업 [65](2,2) "예" → 틀 0x106bc → **139 G포인트 충전**, [66](2,3) "예" → **125** → 0x17f5c(훈련) → 105.
 *
 * **139** = 진입 0x11840 · 틀 0x15954 · 그리기 0x167b8 → 0x5d054 — 공용 충전 화면 0x65a65 / 0x65b01(시즌 0xfa · 메인 메뉴
 * 스페셜과 같다). 단계 [skin+0x314]: 0 목록 넷(값 표 0xd1f0c 실제 현금 100 · 500 · 1000 · 3000원 → 0xd1f1c × 100 =
 * 300 · 1500 · 3300 · 12000 G) — 확인이면 StrMAINMENU[98] "실제 현금 %d원 …" 예/아니오(종류 4, 처음 커서 0) → 단계 1:
 * 예 → 0x707a1(망, 0x16) 결제 요청 · 단계 2(망 응답 +0x70 == 1 이면 G += 값 · 0x1f1b9 저장 · [99] "충전 완료" → 단계 3 → 0) ·
 * 실패면 콜백 0x6354d 가 단계 0 · 오류 글(표 0xd0b1f − 코드×0x80, "%s!N(%d)") / 아니오 → 단계 0. 목록 CLR 이면 닫히고
 * 틀 0x15954 가 **뒤 상태 [장면+0x24] = 108** 로 돌린다 — 108 진입 0x17730 이 다시 돌아 커서가 `min(L, 3)` 이 된다.
 *
 * 웹에는 실제 결제가 없다 — **결제하지 않고 139 를 떠난 길**(목록 CLR)만 옮긴다: G 는 그대로이고 108 을 다시 들어선다.
 * ⚠️ 139 화면(목록 그림 0x5d054 · StrMAINMENU[98] · [99] · 오류 글)은 옮기지 않았다.
 *
 * 돌려주는 차례: [커서, 커서 쓰기, 108 진입, 칸 확인]
 */
export function useMagicTrainingWindow(
  career: PitcherCareer,
  setNotice: Dispatch<SetStateAction<string>>,
  setQuestion: Dispatch<SetStateAction<PitcherMenuQuestion | null>>,
  setSubWindow: Dispatch<SetStateAction<PitcherMenuWindow>>,
  startMagicTraining: (menu: PitcherTrainingMenu) => void,
) {
  const [magicTrainingCursor, setMagicTrainingCursor] = useState(0)

  /** 108 진입 0x17730 — 탭이 2 가 아니면 커서를 `min(s8 [저장+0x201], 3)` 칸에 둔다 (177c8~17806) */
  const enterMagicTraining = useCallback(() => {
    setMagicTrainingCursor(magicTrainingCursorOf(career))
    setSubWindow('마구훈련')
  }, [career, setSubWindow])

  const confirmMagicTrainingCell = useCallback(
    (cell: number) => {
      const block = magicTrainingCellBlockOf(career, cell)
      const blockNotice = magicCellBlockNoticeOf(block, cell)
      if (blockNotice !== null) return setNotice(blockNotice)
      if (block === 'G포인트부족') return setQuestion({ text: modeTextOf(65), onYes: enterMagicTraining })
      const menu = PITCHER_TRAINING_MENUS[PITCHER_TRAINING_MENUS.length - 1]
      return setQuestion({
        text: modeTextOf(66).replace('%d', String(magicTrainingCellCostOf(cell))),
        onYes: () => {
          // 틀 0x106bc 팝업 3 예 → 125 — 108 창은 떠나고, 연출(칸 4) 뒤에 0x17f5c 칸 4 갈래
          setSubWindow(null)
          startMagicTraining(menu)
        },
      })
    },
    [career, enterMagicTraining, setNotice, setQuestion, setSubWindow, startMagicTraining],
  )

  return [magicTrainingCursor, setMagicTrainingCursor, enterMagicTraining, confirmMagicTrainingCell] as const
}
