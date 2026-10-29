import { useEffect, useEffectEvent } from 'react'
import { useTouchScrollKeys } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { POPUP_DIM_OPACITY } from '@/shared/ui/MessageBox/popupDim'
import { SEASON_TEAM_DETAIL_LABEL_FRAMES, SEASON_TRAINING_MAXIMUMS, scrollSeasonTrainingMessages } from '@/widgets/season/lib/seasonTrainingResult'
import type { SeasonTrainingResult } from '@/widgets/season/lib/seasonTrainingResult'
import { ABILITY_DETAIL_VISIBLE_LINES, DetailWindow, detailRowsFromSlots } from './otherSlices'

/** 키 0xf2c8 — 확인(−5 · '5') · 취소(−16) 는 닫기 */
const CLOSE_KEYS: ReadonlySet<string> = new Set(['Enter', '5', ' ', 'Escape', 'Backspace'])
/** 위(−1 · '2') → 0x7d0d8 · 아래(−2 · '8') → 0x7d0fc — 글 상자 첫 줄을 옮긴다 */
const SCROLL_OF_KEY: Readonly<Partial<Record<string, -1 | 1>>> = { ArrowUp: -1, '2': -1, ArrowDown: 1, '8': 1 }

/** 결과 팝업 0xf25c 가 0x872d4 에 넘기는 dy — 나리 상세 창(−4)과 달리 0 이다 */
const SEASON_RESULT_TABLE_Y_OFFSET = 0

/**
 * 훈련 결과 팝업 — 그리기 0xf25c · 키 0xf2c8 (직접 떴다).
 * ```
 * 0xf25c  창 = [장면+0xc8] 프레임 90 박스 0 → 0x871f8(창, 박스, 이름표 372 "RESULT"(img_text), 0) → 0x872d4(창, dy 0) → 0x7f4ed(머리띠)
 * 0xf2c8  확인(−5 · '5') · 취소(−16) → 0x742a9(닫기) · 상태 0xc9
 *         위(−1 · '2') → 0x7d0d8 · 아래(−2 · '8') → 0x7d0fc — 글 상자 첫 줄을 끝에서 반대쪽으로 돌며 옮긴다
 * ```
 * [장면+0xc8] = **ui/mode_ui.pzx** (확정 — 상태 들어옴 0xe9ac 의 0xee6a 가 부르는 0x75fc 가 비었으면 0x77a8 `0xb9719("ui/mode_ui.pzx",
 * "ui/mode_ui.mpl")` 로 채운다). 0xf25c 는 [[+0xc8]+0xc]+8 의 +0x168 = 프레임 90 을 0x94a65(…, 0, 0) 로 박스 0 을 읽는다.
 * 표는 시즌 팀 이름표(46 · 347 · 204 · 205 · 84), 글은 서브 아이템 보정 줄 — 없으면 0x872d4 가 글 상자를 건너뛴다.
 * ⚠️ 0x7f4ed 머리띠를 창 위에 한 번 더 그리지만 창이 머리띠 자리를 안 덮어 보이는 것이 같다 — 따로 안 그린다.
 * **첫 줄 [창+0x2d8] 은 팝업을 열 때 비우지 않는다** (직접 떴다): 창+0x2d8 을 적는 곳은 0x7d0c4(줄 수 +0x2d4 와 함께 0 —
 * 부르는 곳은 0x17f5c 하나, 시즌 장면 밖) · 위 0x7d0d8 · 아래 0x7d0fc 뿐이고, 시즌에서 0x7d0d8 · 0x7d0fc 를 부르는 곳은 이 키
 * 0xf2c8 하나다. 0xc074 · 0x741a0 · 상태 들어옴 0xe9ac(0x7e84c · 0x75fc → 0x7f454)은 창+0x2d8 을 건드리지 않는다.
 * 그래서 앞 팝업에서 내린 첫 줄이 다음 팝업에도 남는다(줄이 적은 글이면 첫 줄이 끝을 넘어 글이 덜 보인다 — 원본 그대로).
 */
export function SeasonTrainingResultPopup({
  result,
  onClose,
  firstLine,
  onFirstLineChange,
}: {
  readonly result: SeasonTrainingResult
  readonly onClose: () => void
  readonly firstLine: number
  readonly onFirstLineChange: (line: number) => void
}) {
  const lineCount = result.messages.length
  const latest = useEffectEvent(() => ({ firstLine, onFirstLineChange }))
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest()
      const scroll = SCROLL_OF_KEY[event.key]
      if (CLOSE_KEYS.has(event.key)) {
        event.preventDefault()
        onClose()
      } else if (scroll !== undefined) {
        event.preventDefault()
        current.onFirstLineChange(scrollSeasonTrainingMessages(current.firstLine, lineCount, scroll))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [lineCount, onClose])
  // 터치 기기 — 글이 창(4줄)을 넘으면 ▲ · ▼ 상황 버튼(↑ · ↓ 키 사건). 원본 그림에는 막대뿐이다
  useTouchScrollKeys(lineCount > ABILITY_DETAIL_VISIBLE_LINES)
  return (
    <DetailWindow
      rows={detailRowsFromSlots(SEASON_TEAM_DETAIL_LABEL_FRAMES, result.current, SEASON_TRAINING_MAXIMUMS, result.change, result.bonus)}
      messages={result.messages}
      onClose={onClose}
      scrollOffset={firstLine}
      tableYOffset={SEASON_RESULT_TABLE_Y_OFFSET}
      hidesEmptyMessages
      // 0x741a0 창 — 시즌 장면 생성자 0x3b14(0x3b1c~0x3b2e)가 [창+0x24f] = 0 · [+0x24c] = 1 이라 그리기마다 검정 단계 5 로 덮는다
      dimOpacity={POPUP_DIM_OPACITY}
      // 0xc074 의 0x741a0(높이 0) — 첫 그림은 펼침이라 글이 없고 그 갱신의 키는 안 본다. 닫는 키(0xf2c8 → 0x742a9)는 창이 가져간다
      opensAsCommonPopup
    />
  )
}
