import { useEffect, useRef } from 'react'
import { ScreenOverlay } from '@/shared/ui'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { screenEffectFrameAt } from '@/entities/story/model/screenEffect'

/** 효과기 종류 1 · 2 — 검정 덮기만 쓴다(색 인자 0) */
export type SeasonScreenFadeKind = '검정에서밝아짐' | '검게어두워짐'

/** 종류 1 · 2 는 단계 보폭 2 로 9 번 칠하고 그 마지막(8 번째, 0 부터) 칠하기에 끝(+0x10 = 2)을 세운다 */
const LAST_DRAWN_FRAME = 8

export interface SeasonScreenFadeProps {
  /** 0xbdae8 의 종류 — 1 '검정에서밝아짐'(실제로는 점점 어두워짐) · 2 '검게어두워짐'(실제로는 검정에서 밝아짐) */
  readonly kind: SeasonScreenFadeKind
  /** 끝(+0x10 = 2)을 본 다음 틀 — 그 틀의 그리기가 끝을 보고 다음 일을 한다(0x8bd8 8ccc~8d2c) */
  readonly onEnd?: () => void
}

/**
 * **화면 효과기 0xbdae8([0x140007c], 종류, 0, 5, 1500)** — 시즌 장면의 전환 덮개(직접 떴다). 효과 몸통은 `entities/story` 의
 * `screenEffectFrameAt`(그리기 0xbd844 — 틀마다 단계 ±2, 9 틀, 끝 다음 틀에 비움)이고, 셋째 · 넷째 인자(5, 1500)는 종류 7 · 8 만 쓴다
 * — 곧 1500ms 가 아니라 **아홉 틀**이다.
 * 효과기가 도는 동안(+4 ≠ 0 · +0x10 == 0)은 시즌 장면의 키 받기 0x4b18 · 0x4b34 가 키를 안 적는다 — 웹은 그동안 키를 삼킨다.
 */
export function SeasonScreenFade({ kind, onEnd }: SeasonScreenFadeProps) {
  const frame = useUpdateCounter()
  const effect = screenEffectFrameAt(kind, '검정', frame)
  const isRunning = frame < LAST_DRAWN_FRAME
  useEffect(() => {
    if (!isRunning) return undefined
    const swallow = (event: KeyboardEvent) => {
      event.stopPropagation()
      event.preventDefault()
    }
    window.addEventListener('keydown', swallow, true)
    return () => window.removeEventListener('keydown', swallow, true)
  }, [isRunning])
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd
  const hasEndedRef = useRef(false)
  useEffect(() => {
    if (effect !== null || hasEndedRef.current) return
    hasEndedRef.current = true
    onEndRef.current?.()
  }, [effect])
  if (effect === null || effect.overlay === null) return null
  return (
    <ScreenOverlay>
      <div data-testid="화면-효과기"
        style={{
          position: 'absolute', inset: 0, background: '#000000', opacity: effect.overlay.opacity,
          pointerEvents: isRunning ? 'auto' : 'none',
        }} />
    </ScreenOverlay>
  )
}
