import { useCallback, useState } from 'react'
import type { PitcherMenuChoice, PitcherMenuDetail, PitcherMenuQuestion } from './menuTypes'

/**
 * 예/아니오 질문 상자와 두 갈래 팝업(0x78·0x80). 두 갈래 팝업의 커서는 원본 `장면+0x166` — 창을 열 때마다 0 에서 시작한다.
 *
 * 돌려주는 차례: [질문, 질문 쓰기, 두 갈래, 커서, 커서 쓰기, 두 갈래 열기, 질문 답, 두 갈래 고름]
 */
export function useMenuPopups() {
  const [question, setQuestion] = useState<PitcherMenuQuestion | null>(null)
  const [choice, setChoice] = useState<PitcherMenuChoice | null>(null)
  const [choiceIndex, setChoiceIndex] = useState(0)

  /** 두 갈래 팝업을 연다 — 커서는 늘 첫 칸부터다 (원본도 `+0x166` 을 0 으로 두고 연다) */
  const openChoice = useCallback((next: PitcherMenuChoice) => {
    setChoiceIndex(0)
    setChoice(next)
  }, [])

  const answerQuestion = useCallback(
    (isYes: boolean) => {
      const asked = question
      setQuestion(null)
      if (isYes && asked !== null) asked.onYes()
    },
    [question],
  )

  // 두 갈래 팝업 0x78 의 키(0x19398)는 팝업(`PitchChoicePopup`)이 창 여닫기와 함께 본다 — 펼치는 동안 · 줄이는 동안은 안 받는다
  const chooseOption = useCallback(
    (index: number) => {
      const asked = choice
      if (asked === null) return
      // 창이 다 닫혔다 — 취소(−16, 0x1942a)는 상태를 안 바꾸고 [창+0x215] 만 세우므로 팝업만 사라진다
      if (index < 0) return setChoice(null)
      asked.onChoose(index)
    },
    [choice],
  )

  return [question, setQuestion, choice, choiceIndex, setChoiceIndex, openChoice, answerQuestion, chooseOption] as const
}

/** 상세 결과 창 — 닫을 때 할 일(부상·회복 판정)을 같이 든다. 돌려주는 차례: [창, 창 쓰기, 닫기] */
export function useDetailWindow() {
  const [detail, setDetail] = useState<PitcherMenuDetail | null>(null)
  const closeDetail = useCallback(() => {
    const shown = detail
    setDetail(null)
    shown?.afterClose()
  }, [detail])
  return [detail, setDetail, closeDetail] as const
}
