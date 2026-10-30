import { useState } from 'react'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useSceneHour } from '@/shared/lib/phoneClock/phoneClock'
import { useModeBackSprite } from '@/shared/lib/phoneClock/useModeBackSprite'
import { ENDING_STAGE } from '@/pages/ending/lib/endingLayout'
import { endingQuestionOf, endingStageOf, type Phase } from './endingPhase'
import type { EndingScreenProps } from './endingProps'
import { useEndingPressKey } from './useEndingPressKey'

/**
 * **엔딩의 진행** — 단계(효과기 틀) · 팝업 단계 · 누름. 엔딩 → (부상·방출이면 이어하기 / 그 밖이면 단계 1 의 키만 단계 2 로 —
 * 어둡게 덮은 뒤 제작진) → 보너스 → 등록. 판정 없음 · 등록 목록 화면은 누름이 없다
 */
export function useEndingFlow(props: EndingScreenProps) {
  const { endingIndex, bonusGamePoint, isContinuable, onContinue } = props
  const [phase, setPhase] = useState<Phase>('엔딩')
  /** 141 에 들어와 돈 틀 수 n = [장면+0x2c] */
  const tick = useUpdateCounter()
  /** 단계 1 의 키(0x12246)를 받은 틀 — 단계 2 의 시작 */
  const [leavingAt, setLeavingAt] = useState<number | null>(null)
  /** 단계 2 → 3 (0x1bf9a: n = 0) — 제작진의 틀 수가 여기서 시작한다 */
  const creditsAt = leavingAt === null ? null : leavingAt + ENDING_STAGE.effectorFrames
  const stage = endingStageOf(tick, creditsAt)
  const sceneHour = useSceneHour()
  /** 띠 안 배경 — 프레임 · 팔레트 = 시간대 [gfx+0x1c] (`BAND_BACKGROUND` 머리말) */
  const band = useModeBackSprite(props.hour ?? sceneHour)
  // 단계 3 의 첫 틀에 제작진으로 (0x1bf9c) — 그 뒤 키가 보너스 · 등록을 묻는다
  if (stage === 3 && phase === '엔딩') setPhase('제작진')
  const question = endingQuestionOf(phase, onContinue, setPhase, () => props.onFinish(false))

  const pressEnding = () => {
    if (isContinuable) return setPhase('이어하기질문')
    if (stage === 1) setLeavingAt(tick)
  }
  const pressCredits = () => setPhase(bonusGamePoint > 0 && props.isBonusReceived !== true ? '보너스' : '등록질문')
  const onPress: (() => void) | undefined = { 엔딩: pressEnding, 제작진: pressCredits }[phase as '엔딩' | '제작진']
  useEndingPressKey(endingIndex >= 0 && phase !== '등록목록' ? onPress : undefined)

  return { phase, setPhase, tick, stage, leavingAt, creditsAt, band, question, onPress }
}
