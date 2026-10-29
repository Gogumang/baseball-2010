import { useEffect, useEffectEvent, useState } from 'react'
import type { ReactNode } from 'react'
import { PressArea, RawScreen } from '@/shared/ui'
import { LeftFrame } from '@/shared/ui/LeftFrame/LeftFrame'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { yearCoverStepAt } from '@/pages/management/lib/nariYearCover'
import { coverOpacityOf } from '@/pages/management/ui/nariYearCover/coverOpacity'
import { YearCover } from '@/pages/management/ui/nariYearCover/YearCover'

export { YearCoverHoldLayer } from '@/pages/management/ui/nariYearCover/YearCoverHoldLayer'
export { YearCoverResumeLeftFrame } from '@/pages/management/ui/nariYearCover/YearCoverResumeLeftFrame'

interface NariYearCoverScreenProps {
  /** S+0xb3 — 새 시즌 0x1b768 이 1 올린 뒤의 연차 idx (표지는 idx 에서 idx + 1 로 숫자를 굴린다) */
  readonly yearIndex: number
  /** 105 관리 화면으로 — 0x12190 의 `0xbcb49(0x69)` 가 적용되는 틀 */
  readonly onDone: () => void
  /**
   * 앞 화면 틀(0 = 0x1b768 을 부른 틀, 0~9)에 **앞 상태가 그 틀에 그리는 그림** — 원본은 0x1b768 뒤에도 앞 상태(114 끝 틀 0x19da4 ·
   * 이어하기 길의 100 · 1 · 105 · 115 · 114)가 매 틀 그리기를 돈다. 상태판은 새 시즌이 고친 S 를 읽는다. null 이면(또는 안 넘기면)
   * 화면 버퍼에 남은 앞 판을 멈춘 채 깐다(`LeftFrame`)
   */
  readonly previousScreenAt?: (frame: number) => ReactNode | null
  /**
   * 이 틀부터 센다 — 앞 화면 아홉 틀을 앞 화면 위에서 이미 돌았으면(134 · 141 — `YearCoverHoldLayer`) `YEAR_COVER_ENTRY_FRAMES`.
   * 안 주면 0(0x1b768 을 부른 틀)부터
   */
  readonly startFrame?: number
}

/** 효과기 덮개의 겹 — 장면 그리기 끝(1d4a4)에 칠해 앞 화면의 대화창 판(`StoryScreen` 30)보다 위 */
const YEAR_COVER_EFFECTOR_LAYER = 40

/**
 * **나리 137 새 시즌 "N년차" 표지** — 차례 · 그림 근거는 `lib/nariYearCover`. 새 시즌 처리 뒤 앞 화면이 아홉 틀 어두워지고,
 * 검정에서 밝아지며 "N년차" 의 숫자가 지난 연차에서 새 연차로 굴러 올라온 뒤 81 틀째(아무 키면 곧바로) 어두워져 105 로 간다.
 */
export function NariYearCoverScreen({ yearIndex, onDone, previousScreenAt, startFrame = 0 }: NariYearCoverScreenProps) {
  const frame = useUpdateCounter() + startFrame
  /** 키를 받은 137 틀 — 키 0x106a4 가 [장면+0x28c] = 0x51 을 넣는 틀(키가 든 그리기의 다음 틀) */
  const [skipAt, setSkipAt] = useState<number | null>(null)
  const step = yearCoverStepAt(frame, skipAt)
  const press = () => {
    if (step.kind !== '표지' || !step.acceptsKey) return
    setSkipAt((previous) => previous ?? step.tick + 1)
  }
  const pressFromKey = useEffectEvent(press)
  useEffect(() => {
    const onKeyDown = () => pressFromKey()
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const done = useEffectEvent(onDone)
  const isDone = step.kind === '관리'
  useEffect(() => {
    if (isDone) done()
  }, [isDone])

  const opacity = coverOpacityOf(step)
  return (
    <RawScreen>
      {step.kind === '앞화면' ? (
        (previousScreenAt?.(frame) ?? <LeftFrame part="year-cover-left" />)
      ) : (
        <YearCover yearIndex={yearIndex} counter={step.kind === '표지' ? step.counter : 0} />
      )}
      {/* 효과기 0xbd844 — 장면 그리기 끝에 칠한다 */}
      {opacity > 0 && (
        // 앞 화면의 이벤트 판(대화창 겹 30)까지 덮는다
        <div
          data-testid="연차표지-효과기"
          style={{ position: 'absolute', inset: 0, background: '#000000', opacity, pointerEvents: 'none', zIndex: YEAR_COVER_EFFECTOR_LAYER }}
        />
      )}
      <PressArea label="건너뛰기" onPress={press} />
    </RawScreen>
  )
}
