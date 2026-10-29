import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useCommonWindowPush } from '@/shared/lib/commonWindow/commonWindow'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import type { BurstJudgement } from '@/entities/burst-mission/model/burstMissionJudge'
import type { BurstMissionRow } from '@/entities/burst-mission/model/burstMissionRow'
import { burstResultPopupTextOf, isBurstWindowOpen } from '@/widgets/burst-mission/lib/burstMissionWindowLayout'
import type { BurstWindowState } from '@/widgets/burst-mission/lib/burstMissionWindowLayout'

/**
 * 닫기 — 다 열린 뒤(c = −1)에만 닫고, 결과를 닫을 때 보상 글을 공용 창 [0x140005c] 에 띄운다(0x74ef5).
 * 창이 떠 있는 동안 키는 창 것이다(잡는 단계에서 멈춘다). 돌려준 ref 를 누름 칸이 부른다
 */
export function useBurstWindowClose(
  stateRef: RefObject<BurstWindowState>,
  judgement: BurstJudgement | null,
  row: BurstMissionRow | null,
  onClose: () => void,
): RefObject<() => void> {
  const pushCommonWindow = useCommonWindowPush()
  const closeRef = useRef(() => {})
  useMirrorRef(closeRef, () => {
    if (!isBurstWindowOpen(stateRef.current)) return
    const popup = burstResultPopupTextOf(judgement, row)
    if (popup !== null) pushCommonWindow(popup)
    onClose()
  })

  // 창이 떠 있는 동안 키는 창 것이다 — 뒤 타석 화면이 같은 Enter 를 같이 받으면 스윙이 나간다.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 잡는 단계에서 멈춰 뒤쪽 타석·커맨드 줄의 window 리스너까지 막는다
      event.stopImmediatePropagation()
      event.preventDefault()
      // 0x8e60c — 다 열리기 전(c ≠ −1)의 키는 버려진다
      closeRef.current()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])
  return closeRef
}
