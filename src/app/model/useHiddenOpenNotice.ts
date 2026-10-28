import { useCallback, useRef, useState } from 'react'
import {
  announceHiddenOpens,
  closeHiddenOpenWindow,
  EMPTY_HIDDEN_OPEN_WINDOW,
  pushHiddenOpenWindow,
} from '@/entities/collection/model/hiddenOpenNotice'
import type { HiddenOpenWindow } from '@/entities/collection/model/hiddenOpenNotice'
import { noteCommonWindowOpensInSceneUpdate } from '@/shared/lib/commonWindow/commonWindow'

/**
 * **히든 오픈 알림 — 공용 창 [0x140005c]** (0x62368 → 0x6249e `0x74ef5(창, 글, 종류 1, 0, 0)`).
 * 원본 창은 장면과 상관없는 전역 객체라 어느 화면 위에도 뜬다. 웹은 앱이 하나 들고 모든 화면 위에 그린다.
 * 띄우는 쪽은 **새로 연 k** 만 넘긴다 — 0x62368 셋째 인자 0 은 이미 열린 k 에 창을 안 띄운다(0x6237c 0x61f5c).
 * 떠 있는 동안 장면이 멈추는 것(0x754f9)은 앱이 `CommonWindowOpenContext` 로 알린다 — 키는 상자가 잡고, 경기 장면은 갱신까지 선다.
 *
 * `then` — 원본 장면이 창 꼬리표를 보고 닫힘 틀에서 다음 상태로 가는 자리(예: 0x1ca4c 꼬리표 0x31 → 메인 메뉴)를
 * 그 창을 닫을 때 부른다.
 */
export function useHiddenOpenNotice() {
  const [window, setWindow] = useState<HiddenOpenWindow>(EMPTY_HIDDEN_OPEN_WINDOW)
  /** 닫기가 이어 할 일을 렌더를 기다리지 않고 읽는다 */
  const windowRef = useRef(window)
  /**
   * 창을 새로 띄운 횟수 — 대기 글로 다시 띄울 때 상자를 새로 세운다(펼침부터). 0x75440 은 대기 칸에 그리기 · 키([+0x3b4] · [+0x3b8])가
   * 있으면 0x741a0, 없으면 글 [+0x2a8] 로 0x74ef4 를 부른다(0x7545a~0x754a6) — 글 알림은 0x74ef4 다.
   * 장면이 [창+0x24f] = 1(경기 0x3301c · 메인 메뉴 0x234d4)이면 닫힘이 줄임 없이 한 갱신이다 — 앱이 지금 화면과 서 있는 경기
   * 장면(`useMarksGameScene`)으로 정해 `MessageBox` 의 `closesWithoutShrink` 에 넘긴다(`sceneClosesWithoutShrinkOf`).
   */
  const [serial, setSerial] = useState(0)
  const update = useCallback((next: (current: HiddenOpenWindow) => HiddenOpenWindow) => {
    const before = windowRef.current
    windowRef.current = next(before)
    // 비어 있던 창에 새 글을 띄운다 — 띄우는 쪽(0x62368 · 0x62234 · 대전 승리 팝업 · 돌발 · 정산 판)은 모두 장면 틀의 키 · 진입 · 갱신
    // 안이라 경기 장면은 그 틀을 마저 돌고 다음 틀부터 선다(`noteCommonWindowOpensInSceneUpdate`). 대기 글을 잇는 닫기(0x754f8 →
    // 0x75440)는 게이트 앞이라 알리지 않는다
    if (before.shown === null && windowRef.current.shown !== null) noteCommonWindowOpensInSceneUpdate()
    setWindow(windowRef.current)
  }, [])
  const announce = useCallback(
    (ids: readonly number[], then: (() => void) | null = null) => {
      if (ids.length === 0) return
      update((current) => announceHiddenOpens(current, ids, then))
    },
    [update],
  )
  /** 글을 그대로 띄운다 — 0x62234(기록달성 누계 해금)·대전 승리 팝업(0x4b100 4b254 · 4b2d4)처럼 0x62368 과 글이 다른 자리 (`push` 도 같다) */
  const announceText = useCallback(
    (text: string) => {
      update((current) => pushHiddenOpenWindow(current, text))
    },
    [update],
  )
  const close = useCallback(() => {
    const then = windowRef.current.shownThen ?? null
    update(closeHiddenOpenWindow)
    setSerial((previous) => previous + 1)
    then?.()
  }, [update])
  return { text: window.shown, serial, announce, announceText, push: announceText, close }
}
