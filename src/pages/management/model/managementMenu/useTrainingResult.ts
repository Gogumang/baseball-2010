import { useState } from 'react'
import { useTrainingPlayback } from '@/widgets/training-scene/model/useTrainingPlayback'

type TrainingResult = 'pending' | 'detail' | 'notice'

/**
 * 결과 창이 떴는지 · 닫혔는지 — 'pending' 은 훈련을 굴린 그 갱신이라 어느 창이 떴는지 이번 그림에서 본다.
 * 창이 닫혔으면(창이 아예 안 떴으면 곧바로) 'closed'.
 */
function trainingResultAfter(result: TrainingResult, hasDetail: boolean, hasNotice: boolean): TrainingResult | 'closed' {
  if (result === 'pending') {
    if (hasDetail) return 'detail'
    return hasNotice ? 'notice' : 'closed'
  }
  const isOpen = result === 'detail' ? hasDetail : hasNotice
  return isOpen ? result : 'closed'
}

interface TrainingResultInput {
  readonly hasDetail: boolean
  readonly hasNotice: boolean
  readonly onTraining: (menuId: string) => void
  /** 결과 창이 닫혀 125 → 105 — 메인 메뉴로 다시 연다(커서는 메뉴 객체 그대로 트레이닝 칸) */
  readonly onClosed: () => void
}

/*
 * 125 의 결과 창 — 연출이 끝난 틀(0x18dd8 의 0x84e58 → 0x17f5c)부터 그 창이 닫힐 때까지 원본은 아직 125 다. 칸 0~3 은 상세 결과 창
 * (닫으면 콜백 0x1b5b8 이 `0xbcb49(0x69)`), 칸 4(필살타법)는 알림 창(닫히면 틀 0x18dd8 이 105)이다. 그동안 그림 0x19da4 는 가운데
 * 판 0x7f814 를 빼고(19dc0~19dd4 — 상태 0x7d), 커맨드 줄은 125 진입이 세운 107 표 그대로다(0x1cdec 1ce1e → 0x7e84c(0x7d) 는
 * 0x6b 와 같은 다섯 칸, 커서는 107 메뉴 객체).
 * 결과 창이 떴는지 · 닫혔는지는 결과 상태와 세션 창(상세 · 알림)만 보고 정한다 — 렌더 중에 맞춘다(예전 레이아웃 효과와 같은 값이
 * 그림 전에 선다. 굴림 · 세션 콜백은 없다). 상세 창 뒤 부상 알림은 105 위에 뜬다(0x1b5b8 이 알림 0x28 을 띄운 뒤 예약)
 */
export function useTrainingResult({ hasDetail, hasNotice, onTraining, onClosed }: TrainingResultInput) {
  const [trainingResult, setTrainingResult] = useState<TrainingResult | null>(null)
  // 훈련 연출이 끝나면 결과를 반영한다 — 메인 메뉴(상태 0x69)로는 결과 창이 닫힐 때 돌아간다
  const playback = useTrainingPlayback((menuId) => {
    setTrainingResult('pending')
    onTraining(menuId)
  })
  const next = trainingResult === null ? null : trainingResultAfter(trainingResult, hasDetail, hasNotice)
  if (next === 'closed') {
    setTrainingResult(null)
    onClosed()
  } else if (next !== trainingResult) setTrainingResult(next)
  /** 상태 125 — 연출(`playback`)과 결과 창 */
  return { playback, isTrainingState: playback.playingMenuId !== null || trainingResult !== null }
}
