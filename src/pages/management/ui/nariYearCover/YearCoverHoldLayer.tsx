import { useEffect, useEffectEvent, useLayoutEffect } from 'react'
import { ScreenOverlay } from '@/shared/ui'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { yearCoverStepAt } from '@/pages/management/lib/nariYearCover'
import { SCREEN_LAYERS } from '@/shared/config/screenLayers'
import { coverOpacityOf } from './coverOpacity'

/** 앞 화면 효과기 겹 — 화면의 창(엔딩 효과기 50 따위)보다 위, 앱 공용 창(55)보다 아래 (`SCREEN_LAYERS`) */
const YEAR_COVER_HOLD_LAYER = SCREEN_LAYERS.COMMON_WINDOW - 1

/**
 * **앞 화면 아홉 틀을 그 화면 위에서** — 새 시즌 0x1b768 을 부른 134(0x1b92c 1bb28) · 141(0x1bbc4 1be26)은 상태를 안 바꾸고 다음 틀부터
 * 제 그리기(134 대진판 0x19fc8 · 141 엔딩 0x882c4)를 돌며 효과기 끝을 기다린다(1bb2c~1bb64 · 1beb4~1beea — +0x289 && [효과기+4] &&
 * [효과기+0x10] == 2 → `0xbcb49(0x89)` · 효과기 종류 2). 웹은 그 화면을 내리지 않고 이 겹이 효과기만 칠한다(`yearCoverStepAt` 의
 * 0~9 틀) — 앞 화면은 새 시즌이 고친 S(소지금 · 연차)로 그대로 그린다. 끝을 본 다음 틀(10)에 `onDone` 이 137 을 띄운다.
 * 효과기가 도는 동안 장면 키 문 0x10758 · 0x10774(나리 장면 0x106 의 누름 · 뗌)가 키를 버린다 — 이 겹이 키와 누름을 먹는다.
 */
export function YearCoverHoldLayer({ onDone }: { readonly onDone: () => void }) {
  const frame = useUpdateCounter()
  const step = yearCoverStepAt(frame, null)
  const isDone = step.kind !== '앞화면'
  const done = useEffectEvent(onDone)
  useEffect(() => {
    if (isDone) done()
  }, [isDone])
  // 앞 화면의 키 처리기(useEffect)보다 먼저 걸리게 레이아웃 효과에서 window 잡는 단계에 건다 (`NariScreenPush` 와 같은 문)
  useLayoutEffect(() => {
    const swallow = (event: KeyboardEvent) => {
      event.stopImmediatePropagation()
      event.preventDefault()
    }
    window.addEventListener('keydown', swallow, true)
    window.addEventListener('keyup', swallow, true)
    return () => {
      window.removeEventListener('keydown', swallow, true)
      window.removeEventListener('keyup', swallow, true)
    }
  }, [])
  // 끝을 본 뒤 137 이 서기까지의 틈은 효과기 종류 2 의 칠하기 0 과 같은 검정이다
  const opacity = isDone ? 1 : coverOpacityOf(step)
  return (
    <ScreenOverlay zIndex={YEAR_COVER_HOLD_LAYER}>
      <div
        data-testid="연차표지-앞화면-효과기"
        data-frame={frame}
        style={{ position: 'absolute', inset: 0, background: '#000000', opacity, pointerEvents: 'auto' }}
      />
    </ScreenOverlay>
  )
}
